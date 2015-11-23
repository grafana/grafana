[![GoDoc](https://godoc.org/github.com/smartystreets/assertions/internal/reqtrace?status.svg)](https://godoc.org/github.com/smartystreets/assertions/internal/reqtrace)

reqtrace is a package for simple request tracing. It requires nothing of its
user except:

 *  They must use [golang.org/x/net/context][context].
 *  They must add a single line to each function they want to be visible in
    traces.

[context]: http://godoc.org/golang.org/x/net/context

In particular, reqtrace is console-based and doesn't require an HTTP server.

**Warning**: This package is still barebones and in its early days. I reserve
the right to make backwards-incompatible changes to its API. But if it's useful
to you in your current form, have at it.

## Use

Call reqtrace.Trace anywhere you want to start a new root trace. (This is
probably where you create your root context.) This returns a new context that
you should pass to child operations, and a reporting function that you must use
to inform reqtrace when the trace is complete.

For example:

```Go
func HandleRequest(r *someRequest) (err error) {
  ctx, report := reqtrace.Trace(context.Background(), "HandleRequest")
  defer func() { report(err) }()

  // Do two things for this request.
  DoSomething(ctx, r)
  DoSomethingElse(ctx, r)
}
```

Within other functions that you want to show up in the trace, you
reqtrace.StartSpan (or its more convenient sibling reqtrace.StartSpanWithError):

```Go
func DoSomething(ctx context.Context, r *someRequest) (err error) {
  defer reqtrace.StartSpanWithError(&ctx, &err, "DoSomething")()

  // Process the request somehow using ctx. If downstream code also annotes
  // using reqtrace, reqtrace will know that its spans are descendants of
  // this one.
  CallAnotherLibrary(ctx, r.Param)
}
```

When `--reqtrace.enable` is set, the completion of a trace will cause helpful
ASCII art to be spit out.
