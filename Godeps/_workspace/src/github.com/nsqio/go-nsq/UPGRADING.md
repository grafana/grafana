This outlines the backwards incompatible changes that were made to the public API after the
`v0.3.7` stable release, and and how to migrate existing legacy codebases.

#### Background

The original `go-nsq` codebase is some of our earliest Go code, and one of our first attempts at a
public Go library.

We've learned a lot over the last 2 years and we wanted `go-nsq` to reflect the experiences we've
had working with the library as well as the general Go conventions and best practices we picked up
along the way.

The diff can be seen via: https://github.com/nsqio/go-nsq/compare/v0.3.7...HEAD

The bulk of the refactoring came via: https://github.com/nsqio/go-nsq/pull/30

#### Naming

Previously, the high-level types we exposed were named `nsq.Reader` and `nsq.Writer`. These
reflected internal naming conventions we had used at bitly for some time but conflated semantics
with what a typical Go developer would expect (they obviously did not implement `io.Reader` and
`io.Writer`).

We renamed these types to `nsq.Consumer` and `nsq.Producer`, which more effectively communicate
their purpose and is consistent with the NSQ documentation.

#### Configuration

In the previous API there were inconsistent and confusing ways to configure your clients.

Now, configuration is performed *before* creating an `nsq.Consumer` or `nsq.Producer` by creating
an `nsq.Config` struct. The only valid way to do this is via `nsq.NewConfig` (i.e. using a struct
literal will panic due to invalid internal state).

The `nsq.Config` struct has exported variables that can be set directly in a type-safe manner. You
can also call `cfg.Validate()` to check that the values are correct and within range.

`nsq.Config` also exposes a convenient helper method `Set(k string, v interface{})` that can set
options by *coercing* the supplied `interface{}` value.

This is incredibly convenient if you're reading options from a config file or in a serialized
format that does not exactly match the native types.

It is both flexible and forgiving.

#### Improving the nsq.Handler interface

`go-nsq` attempts to make writing the common use case consumer incredibly easy.

You specify a type that implements the `nsq.Handler` interface, the interface method is called per
message, and the return value of said method indicates to the library what the response to `nsqd`
should be (`FIN` or `REQ`), all the while managing flow control and backoff.

However, more advanced use cases require the ability to respond to a message *later*
("asynchronously", if you will). Our original API provided a *second* message handler interface
called `nsq.AsyncHandler`.

Unfortunately, it was never obvious from the name alone (or even the documentation) how to properly
use this form. The API was needlessly complex, involving the garbage creation of wrapping structs
to track state and respond to messages.

We originally had the same problem in `pynsq`, our Python client library, and we were able to
resolve the tension and expose an API that was robust and supported all use cases.

The new `go-nsq` message handler interface exposes only `nsq.Handler`, and its `HandleMessage`
method remains identical (specifically, `nsq.AsyncHandler` has been removed).

Additionally, the API to configure handlers has been improved to provide better first-class support
for common operations. We've added `AddConcurrentHandlers` (for quickly spawning multiple handler
goroutines).

For the most common use case, where you want `go-nsq` to respond to messages on your behalf, there
are no changes required! In fact, we've made it even easier to implement the `nsq.Handler`
interface for simple functions by providing the `nsq.HandlerFunc` type (in the spirit of the Go
standard library's `http.HandlerFunc`):

```go
r, err := nsq.NewConsumer("test_topic", "test_channel", nsq.NewConfig())
if err != nil {
    log.Fatalf(err.Error())
}

r.AddHandler(nsq.HandlerFunc(func(m *nsq.Message) error {
    return doSomeWork(m)
})

err := r.ConnectToNSQD(nsqdAddr)
if err != nil {
    log.Fatalf(err.Error())
}

<-r.StopChan
```

In the new API, we've made the `nsq.Message` struct more robust, giving it the ability to proxy
responses. If you want to usurp control of the message from `go-nsq`, you simply call
`msg.DisableAutoResponse()`.

This is effectively the same as if you had used `nsq.AsyncHandler`, only you don't need to manage
`nsq.FinishedMessage` structs or implement a separate interface. Instead you just keep/pass
references to the `nsq.Message` itself, and when you're ready to respond you call `msg.Finish()`,
`msg.Requeue(<duration>)` or `msg.Touch(<duration>)`.  Additionally, this means you can make this
decision on a *per-message* basis rather than for the lifetime of the handler.

Here is an example:

```go
type myHandler struct {}

func (h *myHandler) HandleMessage(m *nsq.Message) error {
    m.DisableAutoResponse()
    workerChan <- m
    return nil
}

go func() {
    for m := range workerChan {
        err := doSomeWork(m)
        if err != nil {
            m.Requeue(-1)
            continue
        }
        m.Finish()
    }
}()

cfg := nsq.NewConfig()
cfg.MaxInFlight = 1000
r, err := nsq.NewConsumer("test_topic", "test_channel", cfg)
if err != nil {
    log.Fatalf(err.Error())
}
r.AddConcurrentHandlers(&myHandler{}, 20)

err := r.ConnectToNSQD(nsqdAddr)
if err != nil {
    log.Fatalf(err.Error())
}

<-r.StopChan
```

#### Requeue without backoff

As a side effect of the message handler restructuring above, it is now trivial to respond to a
message without triggering a backoff state in `nsq.Consumer` (which was not possible in the
previous API).

The `nsq.Message` type now has a `msg.RequeueWithoutBackoff()` method for this purpose.

#### Producer Error Handling

Previously, `Writer` (now `Producer`) returned a triplicate of `frameType`, `responseBody`, and
`error` from calls to `*Publish`.

This required the caller to check both `error` and `frameType` to confirm success. `Producer`
publish methods now return only `error`.

#### Logging

One of the challenges library implementors face is how to provide feedback via logging, while
exposing an interface that follows the standard library and still provides a means to control and
configure the output.

In the new API, we've provided a method on `Consumer` and `Producer` called `SetLogger` that takes
an interface compatible with the Go standard library `log.Logger` (which can be instantiated via
`log.NewLogger`) and a traditional log level integer `nsq.LogLevel{Debug,Info,Warning,Error}`:

    Output(maxdepth int, s string) error

This gives the user the flexibility to control the format, destination, and verbosity while still
conforming to standard library logging conventions.

#### Misc.

Un-exported `NewDeadlineTransport` and `ApiRequest`, which never should have been exported in the
first place.

`nsq.Message` serialization switched away from `binary.{Read,Write}` for performance and
`nsq.Message` now implements the `io.WriterTo` interface.
