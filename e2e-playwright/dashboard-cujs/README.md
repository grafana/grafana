# Dashboard Critical User Journeys (CUJs) E2E Tests

This directory contains end-to-end tests for critical user journeys related to dashboard functionality in Grafana, specifically testing AdHoc Filters, GroupBy Variables, Scopes, and Dashboard Navigation. The test suite validates core dashboard workflows including filtering data across dashboards, autocomplete functionality, operator selection, grouping across multiple dimensions, scope selection and persistence, and navigation between dashboards with state management. Tests use three pre-configured dashboard JSON files (cuj-dashboard-1, cuj-dashboard-2, cuj-dashboard-3) that contain text panels displaying variable values, AdHoc filter variables, GroupBy variables, and time range controls connected to a Prometheus datasource.

## Environment Flags

### `NO_DASHBOARD_IMPORT`

**Default**: `false`

When set to `true`, skips importing test dashboards during global setup. Use this when running against a live Grafana instance that already has the required dashboards with matching UIDs (`cuj-dashboard-1`, `cuj-dashboard-2`, `cuj-dashboard-3`).

```bash
NO_DASHBOARD_IMPORT=true yarn e2e:playwright
```

### `API_CONFIG_PATH`

**Default**: `../dashboards/cujs/config.json`

Configures the path to the API mocking configuration file. This enables dynamic API endpoint configuration for different environments.

If the `API_CONFIG_PATH` is not set, the test suite will use mocked responses for API calls using the default configuration, which has settings for the default testing environment. If set, the test suite will make real API calls instead of using mocks, based on the configuration provided in the specified file. This configuration would be used only in live data scenarios where the endpoints might differ due to testing on different dashboards that might use different DataSources which furthermore might have different API endpoints.

The config file should contain endpoint glob patterns for labels and values APIs. These endpoints are used to fetch labels (keys) and values for the AdHocFilters and the GroupBy variables. The pattern should be a string glob pattern, e.g.: '\*\*/resources/\*\*/labels*'

```bash
API_CONFIG_PATH=/path/to/custom-config.json yarn e2e:playwright
```

## Global Setup and Teardown

### Setup Process (`global-setup.spec.ts`)

The global setup imports three CUJ dashboard JSON files unless `NO_DASHBOARD_IMPORT` is true. It posts each dashboard to `/api/dashboards/import` with overwrite enabled, stores the returned dashboard UIDs in `process.env.DASHBOARD_UIDS` via `setDashboardUIDs()`, and handles cases where dashboards already exist by overwriting them.

### Teardown Process (`global-teardown.spec.ts`)

The teardown retrieves stored dashboard UIDs using `getDashboardUIDs()`, deletes each dashboard via `DELETE /api/dashboards/uid/{uid}`, and cleans up the environment state with `clearDashboardUIDs()`. The dashboard UID state management is handled through `dashboardUidsState.ts` which provides functions to store, retrieve, and clear UIDs in the process environment.
