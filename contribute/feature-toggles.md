# Feature toggle guide

This guide helps you to add your feature behind a _feature flag_, code that lets you enable or disable a feature without redeploying Grafana.

## Steps to adding a feature toggle

1. Define the feature toggle in [registry.go](../pkg/services/featuremgmt/registry.go). To see what each feature stage means, look at the [related comments](../pkg/services/featuremgmt/features.go). If you are a community member, use the [CODEOWNERS](../.github/CODEOWNERS) file to determine which team owns the package you are updating.
2. Run the Go tests mentioned at the top of [this file](../pkg/services/featuremgmt/toggles_gen.go). This generates all the additional files needed: `toggles_gen` for the backend, `grafana-data` for the frontend, and docs. To run the test, run `make gen-feature-toggles`.

## How to use the toggle in your code

Once your feature toggle is defined, you can then wrap your feature around a check if the feature flag is enabled on that Grafana instance.

Examples:

- [Backend](https://github.com/grafana/grafana/blob/feb2b5878b3e3ec551d64872c35edec2a0187812/pkg/services/authn/clients/session.go#L57): Use the `IsEnabled` function and pass in your feature toggle.

### Frontend

Use the new OpenFeature-based feature flag client for all new feature flags. There are two differences compared to the legacy `config.featureToggles` system:

- Feature flag initialisation is async, but will be finished by the time the UI is rendered. This means you cannot get the value of a feature flag at the 'top level' of a module/file
- call `evaluateBooleanFlag("flagName")` from `@grafana/runtime/internal` instead to get the value of a feature flag

e.g.

```ts
import { evaluateBooleanFlag } from '@grafana/runtime/internal';

// BAD - Don't do this. The feature toggle will not evaluate correctly
const isEnabled = evaluateBooleanFlag('newPreferences');

function makeAPICall() {
  // GOOD - The feature toggle should be called after app initialisation
  const isEnabled = evaluateBooleanFlag('newPreferences');
  // ...
}
```

## Enabling toggles in development

Add the feature toggle to the feature_toggle section in your custom.ini, for example:

```
[feature_toggles]
localeFormatPreference=true
```
