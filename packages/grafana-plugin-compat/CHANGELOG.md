# 0.1.0 (2026-09-22)

Initial release. `@grafana/plugin-compat` is in **ALPHA**; the API may change between minor versions.

### Features / Enhancements

- **datasources:** `getDataSourceInstance`, `getDataSourceInstanceList` and `getDataSourceInstanceSettings` under `@grafana/plugin-compat/datasources`. They use the async data source APIs from `@grafana/runtime/unstable` when the host provides them and fall back to the matching `getDataSourceSrv()` methods otherwise.
- **apps:** `getPluginSettings` and `updateAppPluginSettings` under `@grafana/plugin-compat/apps`. They use the plugin-settings APIs from `@grafana/runtime/unstable` when the host provides them and fall back to the `/api/plugins/:id/settings` endpoints via `getBackendSrv()` otherwise.
