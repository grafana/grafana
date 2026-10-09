# 0.3.0 (2026-10-08)

Add `registerRuntimeDataSourceInstance` to `@grafana/plugin-compat/datasources`. It uses the host's async registry when available and falls back to `getDataSourceSrv().registerRuntimeDataSource` otherwise.

# 0.2.0 (2026-09-23)

Add a CommonJS build alongside the existing ESM build, so the package works with `require` as well as `import`.

# 0.1.0 (2026-09-22)

Initial release. `@grafana/plugin-compat` is in **ALPHA**; the API may change between minor versions.
