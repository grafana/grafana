# 0.11.0 (2026-11-10)

Add `getDataSourceInstanceListItem` to `@grafana/plugin-compat/datasources`. It uses the host's stable `@grafana/runtime` export when available and otherwise resolves through `getDataSourceSrv().getInstanceSettings`, returning only the list item fields (`uid`, `name`, `type`, `meta`).

# 0.10.0 (2026-11-10)

Add `useDataSourceInstanceListItem` and the `UseDataSourceInstanceListItemResult` type to `@grafana/plugin-compat/datasources`. The hook uses the host's stable `@grafana/runtime` hook when available and otherwise resolves synchronously through `getDataSourceSrv().getInstanceSettings`, returning only the list item fields (`uid`, `name`, `type`, `meta`).

# 0.9.0 (2026-11-09)

Add `callAppPluginProxy` to `@grafana/plugin-compat/apps`. It uses the host's stable `@grafana/runtime` export when available and falls back to the legacy plugin-proxy endpoint on older hosts.

# 0.8.0 (2026-11-06)

Fix plugins that bundle `@grafana/plugin-compat` failing to load on Grafana older than 11.6. Every earlier release (`0.1.0` to `0.7.0`) imported `@grafana/runtime/unstable`, which those hosts don't provide, so the plugin failed to load even if it never called the affected function. Update to `0.8.0` and rebuild the plugin to pick up the fix.

Each function now uses the host's stable `@grafana/runtime` export when it exists and the legacy `getDataSourceSrv()` or `getBackendSrv()` API otherwise. This changes behavior on Grafana 13.1 and 13.2, which only expose the async APIs under `unstable`: they now take the legacy path, so `registerRuntimeDataSourceInstance` registers into the legacy registry there.

# 0.7.0 (2026-11-03)

Add `getAppPluginHealth` function.

# 0.6.0 (2026-10-22)

Add `useDataSourceInstanceList` and the `GetDataSourceInstanceListFilters` type to `@grafana/plugin-compat/datasources`. The hook uses the host's stable `@grafana/runtime` hook when available, then `@grafana/runtime/unstable`, then fetches through `getDataSourceInstanceList`, so it works on hosts without the async data source hooks.

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
