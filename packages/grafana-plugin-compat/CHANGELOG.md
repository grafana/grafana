# 0.6.0 (2026-10-14)

Export `DataSourceInstanceListItem` and `GetDataSourceInstanceListFilters` types from `@grafana/plugin-compat/datasources`, so the published type declarations no longer reference types that `@grafana/data` and `@grafana/runtime` only have from 13.2.

**Breaking (types only):** the item type no longer has `readOnly` or `isDefault`, which Grafana has since removed. Use `getDataSourceInstanceSettings` or `getDefaultDataSourceInstanceListItem` instead.

# 0.5.0 (2026-10-12)

`getPluginSettings` and `updateAppPluginSettings` now use the host's stable `@grafana/runtime` exports when available, then `@grafana/runtime/unstable`, then the legacy `getBackendSrv()` plugin-settings endpoints, so they keep working once the host removes them from `unstable`.

Add `useDataSourceInstance` to `@grafana/plugin-compat/datasources`. It uses the host's stable `@grafana/runtime` hook when available, then `@grafana/runtime/unstable`, then resolves through `getDataSourceInstance`, so it works on hosts without the async data source hooks.

# 0.4.0 (2026-10-09)

The data source functions now use the host's stable `@grafana/runtime` exports when available, then `@grafana/runtime/unstable`, then the legacy `getDataSourceSrv()` APIs, so they keep working on hosts that only expose the async APIs under `unstable`.

# 0.3.0 (2026-10-08)

Add `registerRuntimeDataSourceInstance` to `@grafana/plugin-compat/datasources`. It uses the host's async registry when available and falls back to `getDataSourceSrv().registerRuntimeDataSource` otherwise.

# 0.2.0 (2026-09-23)

Add a CommonJS build alongside the existing ESM build, so the package works with `require` as well as `import`.

# 0.1.0 (2026-09-22)

Initial release. `@grafana/plugin-compat` is in **ALPHA**; the API may change between minor versions.
