# Feature toggle guide

This guide helps you get started adding your feature behind a feature flag in Grafana.

## Steps to adding a feature toggle

1. Define the feature toggle in [registry.go](../pkg/services/featuremgmt/registry.go). To see what each feature stage means, look at the comments [here](../pkg/services/featuremgmt/features.go). If you are a community member, use the [CODEOWNERS](../.github/CODEOWNERS) file to determine which team owns the package you are updating.
2. Run the go tests mentioned at the top of [this file](../pkg/services/featuremgmt/toggles_gen.go). This will generate all the additional files needed: `toggles_gen` for the backend, `grafana-data` for the frontend, and docs. You can run the test by running `go test ./pkg/services/featuremgmt/...`. This will say the tests failed the first time, but it will have generated the right code. If you re-run the testss, it will pass.

## How to use it in the code

Once your feature toggle is defined, you can then wrap your feature around a check if the feature flag is enabled on that Grafana instance. Here are examples of how to do that:

- [Backend](https://github.com/grafana/grafana/blob/feb2b5878b3e3ec551d64872c35edec2a0187812/pkg/services/authn/clients/session.go#L57): Use the `IsEnabled` function and pass in your feature toggle.
- [Frontend](https://github.com/grafana/grafana/blob/feb2b5878b3e3ec551d64872c35edec2a0187812/public/app/features/search/service/folders.ts#L14): Check the config for your feature toggle.
