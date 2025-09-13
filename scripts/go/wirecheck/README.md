# Wire Checker

A golangci-lint linter that detects direct dependency method calls in wire provider functions, helping maintain proper dependency injection patterns.

## Overview

Wire Checker analyzes Go code to find provider functions that directly call methods on their dependencies, which can lead to tight coupling and violate dependency injection principles.

## Usage

### Lint all files

```bash
make lint-go
```

### VS Code Integration

Configure VS Code to use the custom golangci-lint with wirecheck:

```json
{
  "go.lintTool": "golangci-lint-v2",
  "go.lintFlags": ["--config=${workspaceRoot}/.golangci.yml"],
  "go.alternateTools": {
    "golangci-lint-v2": "${workspaceRoot}/scripts/go/golangci-lint/vscode-wrapper.sh"
  },
  "go.lintOnSave": "package"
}
```

## Example

Here is an example of a wire provider that calls a method on one of its dependencies. This is a problem because it breaks the dskit module/service startup guarantees. The database connection happens during wire initialization instead of during the service's starting phase, which can cause services to start in the wrong order or fail if dependencies aren't healthy and ready to accept requests.

```go
func ProvideUserService(db *Database) (*UserService, error) {
    // BAD: Direct method calls on dependencies
    if err := db.Connect(context.Background()); err != nil {    // ❌ Will be detected
        return nil, err
    }

    return &UserService{db: db}, nil
}
```

Wire Checker will report:

```
provide.go:95:2: ProvideUserService() directly calls db.Connect() in wire provider function
```

### Good Practice

Use a dskit service starting function for initilization.

```go

import "github.com/grafana/dskit/services"

func ProvideUserService(db *Database) *UserService {
  service := &UserService{db: db}
  service.NamedService = services.NewBasicService(service.starting, service.running, nil)
  return service
}

type UserService struct {
    db *Database
    services.NamedService
}

func (s *UserService) starting(ctx context.Context) error {
  return s.db.Connect(ctx)
}

func (s *UserService) running(ctx context.Context) error {
  <- ctx.Done()
  return nil
}
```

## Configuration

Configured in `.golangci.yml`:

```yaml
linters:
  enable:
    - wirecheck
settings:
  custom:
    wirecheck:
      type: module
      description: Check for direct dependency method calls in wire provider functions
      settings:
        wire-gen: ./pkg/server/wire_gen.go
        recursive: true
```
