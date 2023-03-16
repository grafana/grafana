---
aliases:
  - ../../plugins/developing/migration-guide#from-version-62x-to-74x
  - ../../plugins/developing/migration-guide#from-version-65x-to-73x
  - ../../plugins/developing/migration-guide#from-version-6x-to-7x
  - ../../plugins/developing/migration-guide#migrate-to-data-frames
  - ../../plugins/developing/migration-guide#troubleshoot-plugin-migration
description: Guide for migrating plugins from Grafana v6.x to v7.x
keywords:
  - grafana
  - plugins
  - migration
  - plugin
  - documentation
title: Migrating plugins from Grafana version 6.x to 7.x
menutitle: v6.x to v7.x
---

# Migrating plugins from Grafana version 6.x to 7.0

## What's new in Grafana 7.0?

Grafana 7.0 introduced a whole new plugin platform based on React. The new platform supersedes the previous Angular-based plugin platform.

Plugins built using Angular still work for the foreseeable future, but we encourage new plugin authors to develop with the new platform.

### New data format

Along with the move to React, the new plugin platform introduced a new internal data format called [data frames](data-frames.md).

Previously, data source plugins could send data either as time series or tables. With data frames, data sources can send any data in a table-like structure. This gives you more flexibility to visualize your data in Grafana.

### Improved TypeScript support

While the previous Angular-based plugin SDK did support TypeScript, for the React platform, we’ve greatly improved the support. All our APIs are now TypeScript, which might require existing code to update to the new stricter type definitions. Grafana 7.0 also introduced several new APIs for plugin developers that take advantage of many of the new features in Grafana 7.0.

### Grafana Toolkit

With Grafana 7.0, we released a new tool for making it easier to develop plugins. Before, you’d use Gulp, Grunt, or similar tools to generate the minified assets. Grafana Toolkit takes care of building and testing your plugin without complicated configuration files.

For more information, refer to [@grafana/toolkit](https://www.npmjs.com/package/@grafana/toolkit).

### Field options

Grafana 7.0 introduced the concept of _field options_, a new way of configuring your data before it gets visualized. Since this was not available in previous versions, any plugin that enables field-based configuration will not work in previous versions of Grafana.

For plugins prior to Grafana 7.0, all options are considered _Display options_. The tab for field configuration isn't available.

### Backend plugins

While backend plugins were available as an experimental feature in previous versions of Grafana, the support has been greatly improved for Grafana 7. Backend plugins for Grafana 7.0 are backwards-compatible and will continue to work. However, the old backend plugin system has been deprecated, and we recommend that you use the new SDK for backend plugins.

Since Grafana 7.0 introduced signing of backend plugins, community plugins won’t load by default if they’re unsigned.

### Migrate to data frames

Before 7.0, data source and panel plugins exchanged data using either time series or tables. Starting with 7.0, plugins use the new data frame format to pass data from data sources to panels.

Grafana 7.0 is backward compatible with the old data format used in previous versions. Panels and data sources using the old format will still work with plugins using the new data frame format.

The `DataQueryResponse` returned by the `query` method can be either a [LegacyResponseData](https://github.com/grafana/grafana/blob/main/packages/grafana-data/src/types/datasource.ts#L419) or a [DataFrame](https://github.com/grafana/grafana/blob/main/packages/grafana-data/src/types/dataFrame.ts#L200).

The [toDataFrame()](https://github.com/grafana/grafana/blob/main/packages/grafana-data/src/dataframe/processDataFrame.ts#L309) function converts a legacy response, such as `TimeSeries` or `Table`, to a `DataFrame`. Use it to gradually move your code to the new format.

```ts
import { toDataFrame } from '@grafana/data';
```

```ts
async query(options: DataQueryRequest<MyQuery>): Promise<DataQueryResponse> {
  return {
    data: options.targets.map(query => {
      const timeSeries: TimeSeries = await doLegacyRequest(query);
      return toDataFrame(timeSeries);
    }
  };
}
```

## Troubleshoot plugin migration

As of Grafana 7.0, backend plugins can now be cryptographically signed to verify their origin. By default, Grafana ignores unsigned plugins. For more information, refer to [Allow unsigned plugins]({{< relref "../../../administration/plugin-management/#allow-unsigned-plugins" >}}).

## From version 6.5.x to 7.3.0

### getColorForTheme changes

The `getColorForTheme` function arguments have changed from `(color: ColorDefinition, theme?: GrafanaThemeType)` to `(color: string, theme: GrafanaTheme)`.

```ts
// before
const color: ColorDefinition = {
  hue: 'green';
  name: 'dark-green';
  variants: {
    light: '#19730E'
    dark: '#37872D'
  };
}
const themeType: GrafanaThemeType = 'dark';
const themeColor = getColorForTheme(color, themeType);

// after
const color = 'green';
const theme: GrafanaTheme = useTheme();
const themeColor = getColorForTheme(color, theme);

```

## From 6.2.x to v7.4.x

### Legend components

The Legend components have been refactored and introduced the following changes within the `@grafana/ui` package.

```ts
// before
import { LegendItem, LegendOptions, GraphLegend } from '@grafana/ui';

// after
import { VizLegendItem, VizLegendOptions, VizLegend } from '@grafana/ui';
```

- `LegendPlacement` has been updated from `'under' | 'right' | 'over'` to `'bottom' | 'right'` so you can not place the legend above the visualization anymore.
- The `isVisible` in the `LegendItem` has been renamed to `disabled` in `VizLegendItem`.