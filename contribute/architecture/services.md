# Services

A Grafana _service_ encapsulates and exposes application logic to the rest of the application, through a set of related operations. 

Before a service can start communicating with the rest of Grafana, it needs to be registered in the _service registry_.

The service registry keeps track of all available services during runtime. On start-up, Grafana uses the registry to build a dependency graph of services, a _service graph_.

## Your first service

Even though the services in Grafana do different things, they share a number of patterns. To better understand how a service works, let's build one from scratch!

### Create a service

To start building a service:

- Create a new Go package `mysvc` in the [pkg/services](/pkg/services) directory.
- Create a `service.go` file inside your new directory.

All services need to implement the [Service](https://godoc.org/github.com/grafana/grafana/pkg/registry#Service) interface:

```go
type MyService struct {
}

func (s *MyService) Init() error {
    return nil
}
```

The `Init` method is used to initialize and configure the service to make it ready to use. Services that return an error halt Grafana's startup process and cause the error to be logged as it exits.

### Register a service

Every service needs to be registered for the application for it to be included in the service graph.

To register a service, call the `registry.RegisterService` function in a `init` function within your package.

```go
func init() {
    registry.RegisterService(&MyService{})
}
```

`init` functions are only run whenever a package is imported, so we also need to import the package in the application. In the `server.go` file under `pkg/cmd/grafana-server`, import the package we just created:

```go
import _ "github.com/grafana/grafana/pkg/services/mysvc"
```

## Communication

So far, our service is not doing much. Let's change that by having it the rest of the application.

Grafana uses a _bus_ to pass messages to and from a service to other parts of the application. All communication over the bus happens synchronously.

For our service to access the bus, we need to add it to the `MyService` struct:

```go
type MyService struct {
    bus bus.Bus `inject:""`
}
```

> Did you notice the struct tag, `inject:""`? Grafana uses the [inject](https://github.com/facebookgo/inject) package to inject implementations during runtime. 

Now we can start sending and receiving messages! In Grafana, services communicate with each other through three types of messages: _events_, _commands_, and _queries_.

### Events

An event is something that happened in the past. Since an event has already happened, you can't change it. Instead, you can react to events by triggering additional application logic to be run, whenever they occur.

> Because they happened in the past, event names are written in past tense, such as `UserCreated`, and `OrgUpdated`.

#### Subscribe to an event

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

#### Publish an event

If you want to let other services react to changes in your service, you can publish your own events:

```go
event := &events.StickersSentEvent {
    UserID: "taylor",
    Count:   1,
}
if err := s.bus.Publish(event); err != nil {
    return err
}
```

### Commands

A command is a request for an actions to be taken. Unlike an event's fire-and-forget approach, a command can fail as it is handled. The handler will then return an error.

> Because we request an operation to be performed, command are written in imperative mood, such as `CreateFolderCommand`, and `DeletePlaylistCommand`.

#### Dispatch a command

To dispatch a command, pass the object to the `Dispatch` method:

```go
cmd := &models.SendStickersCommand {
    UserID: "taylor",
    Count: 1,
}
if err := s.bus.Dispatch(cmd); err != nil {
  if err == bus.ErrHandlerNotFound {
    return nil
  }
  return err
}
```

**Note:** `Dispatch` will return an error if no handler has been registered for that command.

**Tip:** Browse the available commands in the `models` package.

#### Handle commands

Let others parts of the application dispatch commands to your service, by registering a _command handler_:

To handle a command, register a command handler in the `Init` function.

```go
func (s *MyService) Init() error {
    s.bus.AddHandler(s.SendStickers)
    return nil
}

func (s *MyService) SendStickers(cmd *models.SendStickersCommand) error {
    // ...
}
```

**Note:** The handler method may return an error if unable to complete the command.

### Queries

A command handler can optionally populate the command sent it it. You can use this to implement _queries_.

#### Making a query

To make a query, dispatch the query instance just like you would a command. When the `Dispatch` method returns, the `Results` field contains the result of the query.

```go
query := &models.FindDashboardQuery{
    ID: "foo",
}
if err := bus.Dispatch(query); err != nil {
    return err
}
// The query now contains a result.
for _, item := range query.Results {
    // ...
}
```

#### Return query results

To return results for a query, set any of the fields on the query argument before returning:

```go
func (s *MyService) FindDashboard(query *models.FindDashboardQuery) error {
    // ...
    query.Result = dashboard
    return nil
}
```
