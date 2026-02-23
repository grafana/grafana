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

Use the OpenFeature client for all new backend feature flags.

#### Key points:

- OpenFeature SDK relies on the global state.
- OpenFeature Provider configuration happens in the `commands` module before initialization of other modules.
- It is safe to create an instance of the OpenFeature client directly in a function.
- Flag evaluation is context-aware -- you can pass metadata such as org name, grafana version, or environment to the evaluation context.
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

Use the OpenFeature React hooks for all new feature flags. The React hooks automatically stay up to date with the latest flag values and integrate seamlessly with React components.

#### Using React hooks (recommended)

For React components, use the `useBooleanFlagValue` hook from `@openfeature/react-sdk`:

```tsx
import { useBooleanFlagValue } from '@openfeature/react-sdk';

function MyComponent() {
  // The hook returns the current value and automatically updates when the flag changes
  const isNewPreferencesEnabled = useBooleanFlagValue('newPreferences', false);

  if (isNewPreferencesEnabled) {
    return <NewPreferencesUI />;
  }

  return <LegacyPreferencesUI />;
}
```

Flag values _may_ change over the lifetime of the session, so do not store the result elsewhere in a way it will not react to changes in the flag value.

If using non-boolean flags (a unique feature of the new feature flag system), explore the other exports from `@openfeature/react-sdk` to see how to use them.

#### Using the client directly (non-React contexts)

For advanced, non-React contexts (utilities, class methods, callbacks), you can use the OpenFeature client directly.

However, because this is seperate from the React render loop there are important caveats you must be aware of:

- Flag values are loaded asynchronously, so you cannot call `getBooleanValue()` just at the top-level of a module. You must wait until `app.ts` has initialised until you call a flag otherwise you will only get the default value
- Flag values can change over the lifetime of the session, so do not store or cache the result. Always evaluate flags just in time when you use them, preferably in the if statement, for example.

It is strongly preferred to use the React hooks instead of getting the client.

```ts
import { getFeatureFlagClient } from '@grafana/runtime/internal';

// GOOD - The feature toggle should be called after app initialisation
function doThing() {
  if (getFeatureFlagClient().getBooleanValue('newPreferences', false)) {
    // do new things
  }
}

// BAD - Don't do this. The feature toggle must wait until app initialisation
const isEnabled = getFeatureFlagClient().getBooleanValue('newPreferences', false);

function doThing() {
  if (isEnabled) {
    // do new things
  }
}

// BAD - Don't do this. The feature toggle will not change in response to updates
class FooSrv {
  constructor() {
    this.isEnabled = getFeatureFlagClient().getBooleanValue('newPreferences', false);
  }

  doThing() {
    if (this.isEnabled) {
      // do new things
    }
  }
}
```

## Enabling toggles in development

Add the feature toggle to the feature_toggle section in your custom.ini, for example:

```
[feature_toggles]
localeFormatPreference=true
```
