---
title: Migrate plugins from Grafana version 8.x to 9.x
menuTitle: v8.x to v9.x
description: Guide for migrating plugins from Grafana v8.x to v9.x
keywords:
  - grafana
  - plugins
  - migration
  - plugin
  - documentation
weight: 2300
---

# Migrate plugins from Grafana version 8.x to 9.x

Follow the instructions in this section to migrate plugins from version 8.x to 9.x.

## 9.0 breaking changes

The following breaking changes are introduced in version 9.0 of Grafana.

### `theme.visualization.getColorByName` replaces `getColorForTheme`

The `getColorForTheme` was removed, so you should use `theme.visualization.getColorByName` instead.

**Example:**

```ts
// before
fillColor: getColorForTheme(panel.sparkline.fillColor, config.theme)

// after
fillColor: config.theme.visualization.getColorByName(panel.sparkline.fillColor),
```

### `VizTextDisplayOptions` replaces `TextDisplayOptions`

The `TextDisplayOptions` was removed, so you should use `VizTextDisplayOptions` instead.

**Example:**

```ts
// before
interface Options {
...
text?: TextDisplayOptions;
...
}

// after
interface Options {
...
text?: VizTextDisplayOptions;
...
}
```

### Changes in the internal of `backendSrv.fetch()`

We have changed the internals of `backendSrv.fetch()` to throw an error when the response is an incorrect JSON. Make sure to handle possible errors on the callsite where using `backendSrv.fetch()` (or any other `backendSrv` methods).

```ts
// PREVIOUSLY: this was returning with an empty object {} - in case the response is an invalid JSON
return await getBackendSrv().post(`${API_ROOT}/${id}/install`);

// AFTER THIS CHANGE: the following will throw an error - in case the response is an invalid JSON
return await getBackendSrv().post(`${API_ROOT}/${id}/install`);
```

### `GrafanaTheme2` and `useStyles2` replaces `getFormStyles`

We have removed the deprecated `getFormStyles` function from [grafana-ui](https://www.npmjs.com/package/@grafana/ui). Use `GrafanaTheme2` and the `useStyles2` hook instead.

### `/api/ds/query` replaces `/api/tsdb/query`

We have removed the deprecated `/api/tsdb/query` metrics endpoint. Use [/api/ds/query]({{< relref "../../../http_api/data_source#query-a-data-source" >}}) instead.

### `selectOptionInTest` has been removed

The `@grafana/ui` package helper function `selectOptionInTest` used in frontend tests has been removed because it caused testing libraries to be bundled in the production code of Grafana. If you were using this helper function in your tests, then update your code accordingly:

```ts
// before
import { selectOptionInTest } from '@grafana/ui';
// ...test usage
await selectOptionInTest(selectEl, 'Option 2');

// after
import { select } from 'react-select-event';
// ...test usage
await select(selectEl, 'Option 2', { container: document.body });
```

### Toolkit 9 and webpack

Plugins using custom Webpack configs could potentially break due to the changes between webpack@4 and webpack@5. Please refer to the [official webpack migration guide](https://webpack.js.org/migrate/5/) for assistance.

Webpack 5 does not include polyfills for node.js core modules by default (for example, `buffer`, `stream`, `os`). This can result in failed builds for plugins. If polyfills are required, then it is recommended to create a custom webpack config in the root of the plugin repo and add the required fallbacks:

```js
// webpack.config.js

module.exports.getWebpackConfig = (config, options) => ({
  ...config,
  resolve: {
    ...config.resolve,
    fallback: {
      os: require.resolve('os-browserify/browser'),
      stream: require.resolve('stream-browserify'),
      timers: require.resolve('timers-browserify'),
    },
  },
});
```

Please refer to the webpack build error messages or the [official migration guide](https://webpack.js.org/migrate/5/) for assistance with fallbacks.
