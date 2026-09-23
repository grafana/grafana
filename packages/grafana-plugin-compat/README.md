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
  `getDataSourceInstanceList`, `getDataSourceInstanceSettings`,
  `getDefaultDataSourceInstanceListItem` and its
  `useDefaultDataSourceInstanceListItem` hook. Replacements for
  `getDataSourceSrv()` methods.
- `@grafana/plugin-compat/apps` — `getPluginSettings`,
  `updateAppPluginSettings`. Replacements for the `getBackendSrv()`
  plugin-settings endpoints.

## Usage

```ts
import {
  getDataSourceInstance,
  getDataSourceInstanceList,
  getDefaultDataSourceInstanceListItem,
  useDefaultDataSourceInstanceListItem,
} from '@grafana/plugin-compat/datasources';
import { getPluginSettings } from '@grafana/plugin-compat/apps';

const ds = await getDataSourceInstance({ uid: 'my-uid' });
const settings = await getPluginSettings('my-plugin-id');

// `undefined` unless the org default is one of the items.
const items = await getDataSourceInstanceList({ type: 'prometheus' });
const defaultProm = await getDefaultDataSourceInstanceListItem(items);

const { isLoading, error, item } = useDefaultDataSourceInstanceListItem(items);
```
