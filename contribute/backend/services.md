# Services

A Grafana _service_ encapsulates and exposes application logic to the rest of the application through a set of related operations.

Grafana uses [Wire](https://github.com/google/wire), which is a code generation tool that automates connecting components using [dependency injection](https://en.wikipedia.org/wiki/Dependency_injection). Wire represents dependencies between components as function parameters, which encourages explicit initialization instead of global variables.

Even though the services in Grafana do different things, they share a number of patterns. To better understand how a service works, let's build one from scratch!

Before a service can start communicating with the rest of Grafana, it needs to be registered with Wire. Refer to the `ProvideService` factory method in the following service example and note how it's being referenced in the `wire.go` example.

When you run Wire, it inspects the parameters of `ProvideService` and makes sure that all its dependencies have been wired up and initialized properly.

**Service example:**

```go
package example

// Service service is the service responsible for X, Y and Z.
type Service struct {
    logger   log.Logger
    cfg      *setting.Cfg
    sqlStore db.DB
}

// ProvideService provides Service as dependency for other services.
func ProvideService(cfg *setting.Cfg, sqlStore db.DB) (*Service, error) {
    s := &Service{
        logger:     log.New("service"),
        cfg:        cfg,
        sqlStore:   sqlStore,
    }

    if s.IsDisabled() {
        // skip certain initialization logic
        return s, nil
    }

    if err := s.init(); err != nil {
        return nil, err
    }

    return s, nil
}

func (s *Service) init() error {
    // additional initialization logic...
    return nil
}

// IsDisabled returns true if the service is disabled.
//
// Satisfies the registry.CanBeDisabled interface that guarantees
// that Run() isn't called if the service is disabled.
func (s *Service) IsDisabled() bool {
	return !s.cfg.IsServiceEnabled()
}

// Run runs the service in the background.
//
// Satisfies the registry.BackgroundService interface which
// guarantees that the service can be registered as a background service.
func (s *Service) Run(ctx context.Context) error {
    // background service logic...
    <-ctx.Done()
    return ctx.Err()
}
```

[wire.go](/pkg/server/wire.go)

```go
// +build wireinject

package server

import (
	"github.com/google/wire"
	"github.com/grafana/grafana/pkg/example"
    "github.com/grafana/grafana/pkg/infra/db"
)

var wireBasicSet = wire.NewSet(
	example.ProvideService,

)

var wireSet = wire.NewSet(
	wireBasicSet,
	sqlstore.ProvideService,
)

var wireTestSet = wire.NewSet(
	wireBasicSet,
)

func Initialize(cla setting.CommandLineArgs, opts Options, apiOpts api.ServerOptions) (*Server, error) {
	wire.Build(wireExtsSet)
	return &Server{}, nil
}

func InitializeForTest(cla setting.CommandLineArgs, opts Options, apiOpts api.ServerOptions, sqlStore db.DB) (*Server, error) {
	wire.Build(wireExtsTestSet)
	return &Server{}, nil
}

```

## Background services

A background service runs in the background of the lifecycle between Grafana startup and shutdown. To run your service in the background, it must satisfy the `registry.BackgroundService` interface. Pass it through to the `NewBackgroundServiceRegistry` call in the [ProvideBackgroundServiceRegistry](/pkg/registry/backgroundsvcs/background_services.go) function to register it.

For an example of the `Run` method, see the previous example.

## Disabled services

If you want to guarantee that a background service is not run by Grafana when certain criteria are met, or if a service is disabled, your service must satisfy the `registry.CanBeDisabled` interface. When the `service.IsDisabled` method returns `true`, Grafana won't call the `service.Run` method.

If you want to run certain initialization code whether service is disabled or not, you need to handle this in the service factory method.

For an example of the `IsDisabled` method and custom initialization code when the service is disabled, see the previous implementation code.

## Run Wire (generate code)

Running `make run` calls `make gen-go` on the first run. The `gen-go` in turn calls the Wire binary and generates the code in [`wire_gen.go`](/pkg/server/wire_gen.go). The Wire binary is installed using `go tool` which downloads and installs all the tools needed, including the Wire binary at the specified version.

## OSS vs. Enterprise

Grafana OSS and Grafana Enterprise share code and dependencies. Grafana Enterprise overrides or extends certain OSS services.

There's a [`wireexts_oss.go`](/pkg/server/wireexts_oss.go) that has the `wireinject` and `oss` build tags as requirements. Here you can register services that might have other implementations, for example, Grafana Enterprise.

Similarly, there's a `wireexts_enterprise.go` file in the Enterprise source code repository where you can override or register other service implementations.

To extend an OSS background service, create a specific background interface for that type and inject that type to [`ProvideBackgroundServiceRegistry`](/pkg/registry/backgroundsvcs/background_services.go) instead of the concrete type. Next, add a Wire binding for that interface in [`wireexts_oss.go`](/pkg/server/wireexts_oss.go) and in the enterprise `wireexts` file.

## Methods

Any public method of a service should take `context.Context` as its first argument. If the method calls the bus, it will propagate other services or the database context, if possible.
