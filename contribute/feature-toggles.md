# Feature toggle guide

This guide helps you to add your feature behind a _feature flag_, code that lets you enable or disable a feature without redeploying Grafana.

Exhaustive documentation on OpenFeature can be found at [OpenFeature.dev](https://openfeature.dev/)

## Steps to adding a feature toggle

1. Define the feature toggle in [registry.go](../pkg/services/featuremgmt/registry.go). To see what each feature stage means, look at the [related comments](../pkg/services/featuremgmt/features.go). If you are a community member, use the [CODEOWNERS](../.github/CODEOWNERS) file to determine which team owns the package you are updating.
2. Run the Go tests mentioned at the top of [this file](../pkg/services/featuremgmt/toggles_gen.go). This generates all the additional files needed: `toggles_gen` for the backend, `grafana-data` for the frontend, and docs. To run the test, run `make gen-feature-toggles`.

## How to use the toggle in your code

Once your feature toggle is defined, you can then wrap your feature around a check if the feature flag is enabled on that Grafana instance.

Examples:

### Backend

Use the OpenFeature client for all new backend feature flags and toggles.

#### Key points:

- OpenFeature SDK relies on the global state.
- OpenFeature Provider configuration happens in the `commands` module before initialization of other modules.
- It is safe to create an instance of the OpenFeature client directly in a function.
- Flag evaluation is context-aware -- you can pass metadata such as org name, grafana version, or environment to the evaluation context.
- Flags can be of different types (boolean, string, number, or object).
- Always perform flag evaluation at runtime, not during service startup, to ensure correct and up-to-date flag values.
- Do not cache or store flag values globally -- evaluate flags when needed, especially in request or handler logic.

#### In Grafana code:

```go
import "github.com/open-feature/go-sdk/openfeature"

client := openfeature.NewDefaultClient()

if client.Boolean(ctx, MyTestFlag, false, openfeature.TransactionContext(ctx)) {
    ...
}
```

#### In Tests:

```go
import (
	"github.com/open-feature/go-sdk/openfeature"
	"github.com/open-feature/go-sdk/openfeature/testing"
)

var (
    // Since openfeature relies on global state,
    // TestProvider should be a global instance shared between tests
    // Under the hood it uses a custom _goroutine local_ storage to manage state on a per-test basis
    provider = testing.NewTestProvider()
)

func TestMain(m *testing.M) {
    fmt.Println("Setting up test environment...")

    if err := openfeature.SetProvider(provider); err != nil {
        ...
    }

    exitCode := m.Run()
    os.Exit(exitCode)
}

func TestFoo(t *testing.T) {
    t.Parallel()

    testFlags := map[string]memprovider.InMemoryFlag{
        ...
    }

    provider.UsingFlags(t, testFlags)
    ...
}
```

### Frontend

Use the new OpenFeature-based feature flag client for all new feature flags. There are some differences compared to the legacy `config.featureToggles` system:

- Feature flag initialisation is async, but will be finished by the time the UI is rendered. This means you cannot get the value of a feature flag at the 'top level' of a module/file
- Call `evaluateBooleanFlag("flagName")` from `@grafana/runtime/internal` instead to get the value of a feature flag
- Feature flag values _may_ change over the lifetime of the session. Do not store the value in a variable that is used for longer than a single render - always call `evaluateBooleanFlag` lazily when you use the value.

e.g.

```ts
import { evaluateBooleanFlag } from '@grafana/runtime/internal';

// BAD - Don't do this. The feature toggle will not evaluate correctly
const isEnabled = evaluateBooleanFlag('newPreferences', false);

function makeAPICall() {
  // GOOD - The feature toggle should be called after app initialisation
  if (evaluateBooleanFlag('newPreferences', false)) {
    // do new things
  }
}
```

## Enabling toggles in development

Add the feature toggle to the feature_toggle section in your custom.ini, for example:

```
[feature_toggles]
localeFormatPreference=true
```
