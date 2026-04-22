# Feature flags guide

This guide helps you to add your feature behind a _feature flag_, code that lets you enable or disable a feature without redeploying Grafana.

Exhaustive documentation on OpenFeature can be found at [OpenFeature.dev](https://openfeature.dev/)

## Steps to adding a feature flag

1. Define the feature flag in [registry.go](../pkg/services/featuremgmt/registry.go).
   - New flags must by named with a component, seperated by a dot. e.g `grafana.newPreferencesPage`.
   - Set the `Generate` field to control which clients are generated for your flag (see [Generation targets](#generation-targets) below).
   - To see what each feature stage means, look at the [related comments](../pkg/services/featuremgmt/features.go).
   - If you are a community member, use the [CODEOWNERS](../.github/CODEOWNERS) file to determine which team owns the package you are updating.

2. Run `make gen-feature-toggles` to regenerate all derived files: the backend constants, the legacy frontend types, the OpenFeature React client, and docs.

## Generation targets

The `Generate` field on a `FeatureFlag` controls which clients are generated. The available targets are:

| Target                   | Description                                                                                                             |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| `GenerateLegacyGo`       | Generates a Go constant in `toggles_gen.go`, skipping new name requirements (legacy, prefer `GenerateGo` for new flags) |
| `GenerateLegacyFrontend` | Generates a TypeScript constant in `featureToggles.gen.ts` (legacy, prefer `GenerateReact` for new flags)               |
| `GenerateGo`             | Generates a Go constant in `toggles_gen.go`                                                                             |
| `GenerateReact`          | Generates a typed React hook in `openfeature.gen.ts` via the OpenFeature CLI                                            |

e.g.

```go
{
    Name:        "grafana.newPreferencesPage",
    Description: "Whether to use the new SharedPreferences functional component",
    Stage:       FeatureStageExperimental,
    Generate:    []GenerateTarget{GenerateGo, GenerateReact},
    Owner:       grafanaFrontendPlatformSquad,
    Expression:  "false",
},
```

## How to use the flag in your code

Once your feature flag is defined, you can then wrap your feature around a check if the feature flag is enabled on that Grafana instance.

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

#### Using generated typed hooks (recommended)

For flags with `GenerateReact` set, a typed hook is generated into `packages/grafana-runtime/src/internal/openFeature/openfeature.gen.ts`. Import from `@grafana/runtime/internal`:

```tsx
import { useFlagGrafanaNewPreferencesPage } from '@grafana/runtime/internal';

function MyComponent() {
  const isEnabled = useFlagGrafanaNewPreferencesPage();

  if (isEnabled) {
    return <NewPreferencesUI />;
  }

  return <LegacyPreferencesUI />;
}
```

A `FlagKeys` constant object is also exported, useful for passing flag keys to non-hook APIs:

```ts
import { FlagKeys } from '@grafana/runtime/internal';

client.getBooleanValue(FlagKeys.GrafanaNewPreferencesPage, false);
```

Flag values _may_ change over the lifetime of the session, so do not store the result elsewhere in a way it will not react to changes in the flag value.

#### Using raw React SDK hooks

If the generated hooks don't meet your needs (e.g. you need the flag evaluation details, or a different fallback value), you can use the `@openfeature/react-sdk` directly:

```tsx
import { useBooleanFlagDetails } from '@openfeature/react-sdk';
import { FlagKeys } from '@grafana/runtime/internal';

function MyComponent() {
  const newPreferencesFlag = useBooleanFlagDetails(FlagKeys.GrafanaNewPreferencesPage, true);
  ...
}
```

If using non-boolean flags (a unique feature of the new feature flag system), explore the other exports from `@openfeature/react-sdk` to see how to use them.

#### Using the client directly (non-React contexts)

For advanced, non-React contexts (utilities, class methods, callbacks), you can use the OpenFeature client directly.

However, because this is separate from the React render loop there are important caveats you must be aware of:

- Flag values are loaded asynchronously, so you cannot call `getBooleanValue()` just at the top-level of a module. You must wait until `app.ts` has initialised until you call a flag otherwise you will only get the default value
- Flag values can change over the lifetime of the session, so do not store or cache the result. Always evaluate flags just in time when you use them, preferably in the if statement, for example.

It is strongly preferred to use the React hooks instead of getting the client.

```ts
import { getFeatureFlagClient, FlagKeys } from '@grafana/runtime/internal';

// GOOD - The feature flag should be called after app initialisation
function doThing() {
  if (getFeatureFlagClient().getBooleanValue(FlagKeys.GrafanaNewPreferencesPage, false)) {
    // do new things
  }
}

// BAD - Don't do this. The feature flag must wait until app initialisation
const isEnabled = getFeatureFlagClient().getBooleanValue(FlagKeys.GrafanaNewPreferencesPage, false);

function doThing() {
  if (isEnabled) {
    // do new things
  }
}

// BAD - Don't do this. The feature flag will not change in response to updates
class FooSrv {
  constructor() {
    this.isEnabled = getFeatureFlagClient().getBooleanValue(FlagKeys.GrafanaNewPreferencesPage, false);
  }

  doThing() {
    if (this.isEnabled) {
      // do new things
    }
  }
}
```

## Enabling toggles in development

Add the feature flag to the feature_toggle section in your custom.ini, for example:

```
[feature_toggles]
localeFormatPreference=true
```
