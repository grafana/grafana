# @grafana/plugin-compat

> **@grafana/plugin-compat is currently in ALPHA**.

Compatibility shims that let Grafana plugins adopt new Grafana host APIs right
away, with an automatic fallback for hosts that don't have them yet. Published
and versioned independently of Grafana's release cycle so plugin authors can
pin it without coupling to a Grafana version.

Each function checks for the new host API at runtime and falls back to the
legacy equivalent when it's not available, so a single call works across
Grafana versions.

Ships both ESM and CommonJS builds, so it works with `import` and `require`.

## Domains

- `@grafana/plugin-compat/datasources` — `getDataSourceInstance`,
  `getDataSourceInstanceList`, `getDataSourceInstanceListItem`,
  `getDataSourceInstanceSettings`,
  `getDefaultDataSourceInstanceListItem` and its
  `useDefaultDataSourceInstanceListItem` hook, `useDataSourceInstanceList`,
  `useDataSourceInstanceListItem`, and `registerRuntimeDataSourceInstance`.
  Replacements for `getDataSourceSrv()` methods.
- `@grafana/plugin-compat/apps` — `getPluginSettings`, `updateAppPluginSettings`,
  `getAppPluginHealth`, and `callAppPluginProxy`. Replacements for the
  `getBackendSrv()` plugin-settings, app-health, and plugin-proxy endpoints.

## Usage

```ts
import {
  getDataSourceInstance,
  getDataSourceInstanceList,
  getDataSourceInstanceListItem,
  getDefaultDataSourceInstanceListItem,
  registerRuntimeDataSourceInstance,
  useDataSourceInstanceListItem,
  useDefaultDataSourceInstanceListItem,
} from '@grafana/plugin-compat/datasources';
import { callAppPluginProxy, getAppPluginHealth, getPluginSettings } from '@grafana/plugin-compat/apps';

const ds = await getDataSourceInstance({ uid: 'my-uid' });
const settings = await getPluginSettings('my-plugin-id');
const health = await getAppPluginHealth('my-plugin-id');
const proxyResponse = await callAppPluginProxy({
  pluginId: 'myorg-myplugin-app',
  routePath: 'my-route/resource',
});

// `undefined` unless the org default is one of the items.
const items = await getDataSourceInstanceList({ type: 'prometheus' });
const defaultProm = await getDefaultDataSourceInstanceListItem(items);

const { isLoading, error, item } = useDefaultDataSourceInstanceListItem(items);

// Identity and plugin metadata only, without `jsonData`, `url` or `access`.
const lokiListItem = await getDataSourceInstanceListItem({ uid: 'my-loki-uid' });
const { item: lokiItem } = useDataSourceInstanceListItem({ uid: 'my-loki-uid' });

// Throws if a data source with the same uid is already registered.
registerRuntimeDataSourceInstance({ dataSource: new MyRuntimeDataSource('my-plugin-id', 'my-uid') });
```

`getAppPluginHealth` resolves with the health result for both healthy and unhealthy responses. Inspect `health?.status`; authentication, transport, and other non-health failures reject. The k8s path defaults an omitted message to an empty string; legacy health responses are returned unchanged. Known non-app plugins return `undefined` when k8s metadata is available.

`callAppPluginProxy` sends a GET request to a configured app proxy route; `routePath` is relative, without a leading slash. It uses the host's stable `@grafana/runtime` export when available, otherwise the legacy `/api/plugin-proxy/:pluginId/*` endpoint. The optional `apiVersion` is ignored by legacy requests; `showErrorAlert` defaults to `false`.

On hosts with the async APIs, a data source registered this way is not visible
to `getDataSourceSrv()`. Look it up with `getDataSourceInstance` instead.
