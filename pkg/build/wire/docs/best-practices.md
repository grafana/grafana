# Best Practices

The following are practices we recommend for using Wire. This list will grow
over time.

## Distinguishing Types

If you need to inject a common type like `string`, create a new string type to
avoid conflicts with other providers. For example:

```go
type MySQLConnectionString string
```

## Options Structs

A provider function that includes many dependencies can pair the function with
an options struct.

```go
type Options struct {
    // Messages is the set of recommended greetings.
    Messages []Message
    // Writer is the location to send greetings. nil goes to stdout.
    Writer io.Writer
}

func NewGreeter(ctx context.Context, opts *Options) (*Greeter, error) {
    // ...
}

var GreeterSet = wire.NewSet(wire.Struct(new(Options), "*"), NewGreeter)
```

## Provider Sets in Libraries

When creating a provider set for use in a library, the only changes you can make
without breaking compatibility are:

-   Change which provider a provider set uses to provide a specific output, as
    long as it does not introduce a new input to the provider set. It may remove
    inputs. However, note that existing injectors will use the old provider
    until they are regenerated.
-   Introduce a new output type into the provider set, but only if the type
    itself is newly added. If the type is not new, it is possible that some
    injector already has the output type included, which would cause a conflict.

All other changes are not safe. This includes:

-   Requiring a new input in the provider set.
-   Removing an output type from a provider set.
-   Adding an existing output type into the provider set.

Instead of making one of these breaking changes, consider adding a new provider
set.

As an example, if you have a provider set like this:

```go
var GreeterSet = wire.NewSet(NewStdoutGreeter)

func DefaultGreeter(ctx context.Context) *Greeter {
    // ...
}

func NewStdoutGreeter(ctx context.Context, msgs []Message) *Greeter {
    // ...
}

func NewGreeter(ctx context.Context, w io.Writer, msgs []Message) (*Greeter, error) {
    // ...
}
```

You may:

-   Use `DefaultGreeter` instead of `NewStdoutGreeter` in `GreeterSet`.
-   Create a new type `T` and add a provider for `T` to `GreeterSet`, as long as
    `T` is introduced in the same commit/release as the provider is added.

You may not:

-   Use `NewGreeter` instead of `NewStdoutGreeter` in `GreeterSet`. This both
    adds an input type (`io.Writer`) and requires injectors to return an `error`
    where the provider of `*Greeter` did not require this before.
-   Remove `NewStdoutGreeter` from `GreeterSet`. Injectors depending on
    `*Greeter` will be broken.
-   Add a provider for `io.Writer` to `GreeterSet`. Injectors might already have
    a provider for `io.Writer` which might conflict with this one.

As such, you should pick the output types in a library provider set carefully.
In general, prefer small provider sets in a library. For example, it is common
for a library provider set to contain a single provider function along with a
`wire.Bind` to the interface the return type implements. Avoiding larger
provider sets reduces the likelihood that applications will encounter conflicts.
To illustrate, imagine your library provides a client for a web service. While
it may be tempting to bundle a provider for `*http.Client` in a provider set for
your library's client, doing so would cause conflicts if every library did the
same. Instead, the library's provider set should only include the provider for
the API client, and let `*http.Client` be an input of the provider set.

## Mocking

There are two approaches for creating an injected app with mocked dependencies.
Examples of both approaches are shown
[here](https://github.com/google/wire/tree/master/internal/wire/testdata/ExampleWithMocks/foo).

### Approach A: Pass mocks to the injector

Create a test-only injector that takes all of the mocks as arguments; the
argument types must be the interface types the mocks are mocking. `wire.Build`
can't include providers for the mocked dependencies without creating conflicts,
so if you're using provider set(s) you will need to define one that doesn't
include the mocked types.

### Approach B: Return the mocks from the injector

Create a new struct that includes the app plus all of the dependencies you want
to mock. Create a test-only injector that returns this struct, give it providers
for the concrete mock types, and use `wire.Bind` to tell Wire that the concrete
mock types should be used to fulfill the appropriate interface.
