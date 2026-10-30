## 0.6.0 (2026-10-22)

Add `useDataSourceInstanceList` and the `GetDataSourceInstanceListFilters` type to `@grafana/plugin-compat/datasources`. The hook uses the host's stable `@grafana/runtime` hook when available, then `@grafana/runtime/unstable`, then fetches through `getDataSourceInstanceList`, so it works on hosts without the async data source hooks.

## 0.5.0 (2026-10-12)

`getPluginSettings` and `updateAppPluginSettings` now use the host's stable `@grafana/runtime` exports when available, then `@grafana/runtime/unstable`, then the legacy `getBackendSrv()` plugin-settings endpoints, so they keep working once the host removes them from `unstable`.

Add `useDataSourceInstance` to `@grafana/plugin-compat/datasources`. It uses the host's stable `@grafana/runtime` hook when available, then `@grafana/runtime/unstable`, then resolves through `getDataSourceInstance`, so it works on hosts without the async data source hooks.

## 0.4.0 (2026-10-09)

The data source functions now use the host's stable `@grafana/runtime` exports when available, then `@grafana/runtime/unstable`, then the legacy `getDataSourceSrv()` APIs, so they keep working on hosts that only expose the async APIs under `unstable`.

## 0.3.0 (2026-10-08)

Add `registerRuntimeDataSourceInstance` to `@grafana/plugin-compat/datasources`. It uses the host's async registry when available and falls back to `getDataSourceSrv().registerRuntimeDataSource` otherwise.

## 0.2.0 (2026-09-23)

Add a CommonJS build alongside the existing ESM build, so the package works with `require` as well as `import`.

## 0.1.0 (2026-09-22)

Initial release. `@grafana/plugin-compat` is in **ALPHA**; the API may change between minor versions.
