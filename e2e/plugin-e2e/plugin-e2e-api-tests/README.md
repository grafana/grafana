# @grafana/plugin-e2e API tests

The purpose of the E2E tests in this directory is not to test the plugins per se - it's to verify that the fixtures, models and expect matchers provided by the [`@grafana/plugin-e2e`](https://github.com/grafana/plugin-tools/tree/main/packages/plugin-e2e) package are compatible with the latest version of Grafana. If you find that any of these tests are failing, it's probably due to one of the following reasons:

- you have changed a value of a selector defined in @grafana/e2e-selector
- you have made structural changes to the UI

For information on how to address this, follow the instructions in the [contributing guidelines](https://github.com/grafana/plugin-tools/blob/main/packages/plugin-e2e/CONTRIBUTING.md#how-to-fix-broken-test-scenarios-after-changes-in-grafana) for the @grafana/plugin-e2e package in the plugin-tools repository.
