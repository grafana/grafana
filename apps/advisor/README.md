# Grafana Advisor - Implementing New Checks

This guide explains how to implement new checks in the Grafana Advisor system. The Advisor system allows you to create custom checks that can validate various aspects of your Grafana instance.

## Check Structure

A check in Grafana Advisor consists of two main components:

1. A main check struct that implements the [`checks.Check`](https://github.com/grafana/grafana/blob/269226cb50b970ad9f692f1fdd220e9822e90db8/apps/advisor/pkg/app/checks/ifaces.go#L11-L25) interface
2. One or more step structs that implement the [`checks.Step`](https://github.com/grafana/grafana/blob/269226cb50b970ad9f692f1fdd220e9822e90db8/apps/advisor/pkg/app/checks/ifaces.go#L28-L39) interface

## Implementing a New Check

### 1. Create the Check Package

Create a new package in `pkg/app/checks/` for your check. For example, if you're creating a check for validating configuration fields, you might create `pkg/app/checks/configchecks/`. Add a `check.go` file to the package, there we will implement the check interface. Let's start by implementing the `Check` interface but without any steps yet:

```go
package configchecks

var _ checks.Check = (*check)(nil)

type check struct{}

func New() checks.Check {
	return &check{}
}

func (c *check) ID() string {
	return "config"
}

func (c *check) Name() string {
	return "config setting"
}

func (c *check) Items(ctx context.Context) ([]any, error) {
	return nil, nil
}

func (c *check) Item(ctx context.Context, id string) (any, error) {
	return nil, nil
}

func (c *check) Init(ctx context.Context) error {
	return nil
}

func (c *check) Steps() []checks.Step {
	return []checks.Step{}
}

```

### 2. Define Dependencies and Register the Check

In order to be able to implement a check, it will likely need some dependencies in the form of `wire` services. This is the internal dependency injection system used in Grafana and it allows you to access the services you need.

For our example, we will need access to the grafana settings, which are exposed by wire as `*setting.Cfg` (in this case is a pointer to a struct, not an interface but the idea is the same). So let's add it to our check as a parameter for our `New` function:

```go
type check struct {
	cfg *setting.Cfg
}

func New(cfg *setting.Cfg) checks.Check {
	return &check{
		cfg: cfg,
	}
}
```

Now, to register our check in the `checkregistry` package, we need to add it to the `ProvideService` function. First, we need to verify that the services we need are available in the `ProvideService` function, and if not, add them. Then, we need to add our check to the `Checks` slice.

```go
func ProvideService(..., cfg *setting.Cfg,
) *Service {
    return &Service{
        ...
        cfg: cfg,
    }
}

func (s *Service) Checks() []checks.Check {
	return []checks.Check{
        ...
        configchecks.New(s.cfg),
    }
}
```

### 3. Complete the Check Implementation

Now that we have our check registered, we can implement the rest of the check logic.

#### 3.1. Implement the `Items` and `Item` methods

The `Items` method is used to return a list of items that the check will be run on (e.g. all data sources, all plugins, etc). The `Item` method is used to return a single item by its ID.

These functions can return `any` type, we will convert them to the expected type in the step `Run` method.

In our case, we will implement the `Items` method to return a list of config sections that we want to check. The `Item` method will return a single config section by its name.

```go
func (c *check) Items(ctx context.Context) ([]any, error) {
	return []any{"security.secret_key"}, nil
}

func (c *check) Item(ctx context.Context, id string) (any, error) {
	return id, nil
}
```

Check other checks for examples of how to implement these methods in more interesting ways.

#### 3.2. Implement the `Init` method

The `Init` method is used to initialize the check. It is called when the check is first created. It should be used to gather any information that is needed to run the check and for the steps to have some shared context.

In our case, we don't need to do anything special so we can just return `nil`.

```go
func (c *check) Init(ctx context.Context) error {
	return nil
}
```

One more interesting example is the `plugincheck`, where we gather all the plugin information from GCOM and store it in the check struct.

### 4. Implement Steps

Like the `Check` interface, each `Step` needs to return some information (metadata) about the step, which will be used to populate the UI, and the logic to `Run` the step.

In our example, we will implement a step that will check if the `security.secret_key` is set correctly. In case it's not correct, we recommend the user to follow the documentation.

Check [`security_config_step.go`](./pkg/app/checks/configchecks/security_config_step.go) for the full implementation.

## Best Practices

1. **Error Handling**: In general, avoid returning errors for known issues, these will mark the check report as failed and the UI will render an error page. Only unexpected errors should be returned.

2. **Type Safety**: Use type assertions to ensure you're working with the correct type of item.

3. **Severity Levels**: Use appropriate severity levels:

   - `CheckReportFailureSeverityHigh`: For critical issues that need immediate attention
   - `CheckReportFailureSeverityLow`: For non-critical issues that can be addressed later

4. **Resolution Links**: Provide helpful links in the `CheckErrorLink` slice to help users resolve issues.

5. **Logging**: Use the provided logger to log important information and errors.

## Testing

Create tests for your check and its steps to ensure they work as expected. Test both successful and failure scenarios.
