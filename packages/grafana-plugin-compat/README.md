# @grafana/plugin-compat

> **@grafana/plugin-compat is currently in ALPHA**.

Compatibility shims that let Grafana plugins adopt new Grafana host APIs right
away, with an automatic fallback for hosts that don't have them yet. Published
and versioned independently of Grafana's release cycle so plugin authors can
pin it without coupling to a Grafana version.

## Domains

- `@grafana/plugin-compat/datasources` — async wrappers around the
  `DataSourceSrv` replacement APIs.

Usage examples land once the wrapped APIs are wired up in a follow-up PR.
