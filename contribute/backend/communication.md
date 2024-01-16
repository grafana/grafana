# Communication

Grafana use dependency injection and method calls on Go interfaces to
communicate between different parts of the backend.

## Commands and queries

Grafana structures arguments to [services](services.md) using a command/query
separation where commands are instructions for a mutation and queries retrieve
records from a service.

Services should define their methods as `func[T, U any](ctx context.Context, args T) (U, error)`.

Each function should take two arguments. First, a `context.Context` that
carries information about the tracing span, cancellation, and similar
runtime information that might be relevant to the call. Secondly, `T` is
a `struct` defined in the service's root package (see the instructions
for [package hierarchy](package-hierarchy.md)) that contains zero or
more arguments that can be passed to the method.

The return values is more flexible, and may consist of none, one, or two
values. If there are two values returned, the second value should be
either an `bool` or `error` indicating the success or failure of the
call. The first value `U` carries a value of any exported type that
makes sense for the service.

Following is an example of an interface providing method signatures for
some calls adhering to these guidelines:

```
type Alphabetical interface {
  // GetLetter returns either an error or letter.
  GetLetter(context.Context, GetLetterQuery) (Letter, error)
  // ListCachedLetters cannot fail, and doesn't return an error.
  ListCachedLetters(context.Context, ListCachedLettersQuery) Letters
  // DeleteLetter doesn't have any return values other than errors, so it
  // returns only an error.
  DeleteLetter(context.Contxt, DeleteLetterCommand) error
}
```

> Because we request an operation to be performed, command are written in imperative mood, such as `CreateFolderCommand`, `GetDashboardQuery` and `DeletePlaylistCommand`.

The use of complex types for arguments in Go means a few different
things for us, it provides us with the equivalent of named parameters
from other languages, and it reduces the headache of figuring out which
argument is which that often occurs with three or more arguments.

On the flip-side, it means that all input parameters are optional and
that it is up to the programmer to make sure that the zero value is
useful or at least safe for all fields and that while it's easy to add
another field, if that field must be set for the correct function of the
service that is not detectable at compile time.

### Queries with Result fields

Some queries have a Result field that is mutated and populated by the
method being called. This is a remainder from when the _bus_ was used
for sending commands and queries as well as for events.

All bus commands and queries had to implement the Go type
`func(ctx context.Context, msg interface{}) error`
and mutation of the `msg` variable or returning structured information in
`error` were the two most convenient ways to communicate with the caller.

All `Result` fields should be refactored so that they are returned from
the query method:

```
type GetQuery struct {
  Something int

  Result ResultType
}

func (s *Service) Get(ctx context.Context, cmd *GetQuery) error {
  // ...do something
  cmd.Result = result
  return nil
}
```

should become

```
type GetQuery struct {
  Something int
}

func (s *Service) Get(ctx context.Context, cmd GetQuery) (ResultType, error) {
  // ...do something
  return result, nil
}
```

## Events

An event is something that happened in the past. Since an event has already happened, you can't change it. Instead, you can react to events by triggering additional application logic to be run, whenever they occur.

> Because they happened in the past, event names are written in past tense, such as `UserCreated`, and `OrgUpdated`.

### Subscribe to an event

In order to react to an event, you first need to _subscribe_ to it.

To subscribe to an event, register an _event listener_ in the service's `Init` method:

```go
func (s *MyService) Init() error {
    s.bus.AddEventListener(s.UserCreated)
    return nil
}

func (s *MyService) UserCreated(event *events.UserCreated) error {
    // ...
}
```

**Tip:** Browse the available events in the `events` package.

### Publish an event

If you want to let other parts of the application react to changes in a service, you can publish your own events:

```go
event := &events.StickersSentEvent {
    UserID: "taylor",
    Count:   1,
}
if err := s.bus.Publish(event); err != nil {
    return err
}
```
