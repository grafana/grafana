# Services

A Grafana _service_ encapsulates and exposes application logic to the rest of the application, through a set of related operations. 

Before a service can start communicating with the rest of Grafana, it needs to be registered in the _service registry_.

The service registry keeps track of all available services during runtime. On start-up, Grafana uses the registry to build a dependency graph of services, a _service graph_.

Even though the services in Grafana do different things, they share a number of patterns. To better understand how a service works, let's build one from scratch!

## Create a service

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

## Register a service

Every service needs to be registered with the application for it to be included in the service graph.

To register a service, call the `registry.RegisterService` function in an `init` function within your package.

```go
func init() {
    registry.RegisterService(&MyService{})
}
```

`init` functions are only run whenever a package is imported, so we also need to import the package in the application. In the `server.go` file under `pkg/server`, import the package we just created:

```go
import _ "github.com/grafana/grafana/pkg/services/mysvc"
```

## Dependencies

Grafana uses the [inject](https://github.com/facebookgo/inject) package to inject dependencies during runtime. 

For example, to access the [bus](communication.md), add it to the `MyService` struct:

```go
type MyService struct {
    Bus bus.Bus `inject:""`
}
```

You can also inject other services in the same way:

```go
type MyService struct {
    Service other.Service `inject:""`
}
```

> **Note:** Any injected dependency needs to be an exported field. Any unexported fields result in a runtime error.
