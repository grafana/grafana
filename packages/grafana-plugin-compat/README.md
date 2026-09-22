# @grafana/plugin-compat

> **@grafana/plugin-compat is currently in ALPHA**.

Compatibility shims that let Grafana plugins adopt new Grafana host APIs right
away, with an automatic fallback for hosts that don't have them yet. Published
and versioned independently of Grafana's release cycle so plugin authors can
pin it without coupling to a Grafana version.

Each function checks for the new host API at runtime and falls back to the
legacy equivalent when it's not available, so a single call works across
Grafana versions.

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

## Testing with Jest

This package is ESM-only and ships `.mjs` files. Jest runs plugin tests as
CommonJS and does not transform `node_modules` by default, so it has to be told
to transform this package. Plugins scaffolded or updated with
`@grafana/create-plugin` 7.11.1 or later get this out of the box. On older
scaffolds, extend `jest.config.js` like so:

```js
const { grafanaESModules, nodeModulesToTransform } = require('./.config/jest/utils');
const baseConfig = require('./.config/jest.config');

module.exports = {
  ...baseConfig,
  transformIgnorePatterns: [nodeModulesToTransform([...grafanaESModules, '@grafana/plugin-compat'])],
  transform: {
    // The scaffolded pattern only matches .ts/.tsx/.js/.jsx, so .mjs files
    // would otherwise be loaded untransformed.
    '^.+\\.(t|j)sx?$|^.+\\.mjs$': baseConfig.transform['^.+\\.(t|j)sx?$'],
  },
};
```
