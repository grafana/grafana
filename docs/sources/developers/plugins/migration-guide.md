+++
title = "Plugin migration guide"
+++

# Plugin migration guide

## Introduction

This guide explains how to migrate Grafana plugins from previous version to the latest version available. It is structured in a way where you easily should be able to identify what steps you need to take given the Grafana version your plugin currently support.

> If you've successfully migrated your plugin by using this guide and think something is missing, please [submit an issue on GitHub](https://github.com/grafana/grafana/issues/new?title=Docs%20feedback:%20/developers/plugins/migration-guide.md) and share your experiences with us so that we can improve this guide!

## Table of contents

- [From version 7.x.x to 8.0.0](#from-version-7xx-to-800)
  - [8.0 deprecations](#80-deprecations)
- [From version 6.2.x to 7.4.0](#from-version-62x-to-740)
  - [Legend components](#legend-components)
- [From version 6.x.x to 7.0.0](#from-version-6xx-to-700)
  - [What's new in Grafana 7.0?](#whats-new-in-grafana-70)
  - [Migrate a plugin from Angular to React](#migrate-a-plugin-from-angular-to-react)
    - [Migrate a panel plugin](#migrate-a-panel-plugin)
    - [Migrate a data source plugin](#migrate-a-data-source-plugin)
    - [Migrate to data frames](#migrate-to-data-frames)
  - [Troubleshoot plugin migration](#troubleshoot-plugin-migration)

## From version 7.x.x to 8.x.x

### 8.0 deprecations

## From version 6.2.x to 7.4.0

### Legend components

The Legend components have been refactored and introduced the following changes within the `@grafana/ui` package.

```ts
// before
import { LegendItem, LegendOptions, GraphLegend } from '@grafana/ui';

// after
import { VizLegendItem, VizLegendOptions, VizLegend } from '@grafana/ui';
```

The values for the `LegendPlacement` has been updated from `'under' | 'right' | 'over'` to `'bottom' | 'right'` so you can not place the legend above the visualization anymore.

The `isVisible` in the `LegendItem` has been renamed to `disabled` in `VizLegendItem`.

## From version 6.x.x to 7.x.x

### What's new in Grafana 7.0?

Grafana 7.0 introduced a whole new plugin platform based on React. The new platform supersedes the previous Angular-based plugin platform.

Plugins built using Angular still work for the foreseeable future, but we encourage new plugin authors to develop with the new platform.

#### New data format

Along with the move to React, the new plugin platform introduced a new internal data format called [data frames]({{< relref "data-frames.md" >}}).

Previously, data source plugins could send data either as time series or tables. With data frames, data sources can send any data in a table-like structure. This gives you more flexibility to visualize your data in Grafana.

#### Improved TypeScript support

While the previous Angular-based plugin SDK did support TypeScript, for the React platform, we’ve greatly improved the support. All our APIs are now TypeScript, which might require existing code to update to the new stricter type definitions. Grafana 7.0 also introduced several new APIs for plugin developers that take advantage of many of the new features in Grafana 7.0.

#### Grafana Toolkit

With Grafana 7.0, we released a new tool for making it easier to develop plugins. Before, you’d use Gulp, Grunt, or similar tools to generate the minified assets. Grafana Toolkit takes care of building and testing your plugin without complicated configuration files.

For more information, refer to [@grafana/toolkit](https://www.npmjs.com/package/@grafana/toolkit).

#### Field options

Grafana 7.0 introduced the concept of _field options_, a new way of configuring your data before it gets visualized. Since this was not available in previous versions, any plugin that enables field-based configuration will not work in previous versions of Grafana.

For plugins prior to Grafana 7.0, all options are considered _Display options_. The tab for field configuration isn't available.

#### Backend plugins

While backend plugins were available as an experimental feature in previous versions of Grafana, the support has been greatly improved for Grafana 7. Backend plugins for Grafana 7.0 are backwards-compatible and will continue to work. However, the old backend plugin system has been deprecated, and we recommend that you use the new SDK for backend plugins.

Since Grafana 7.0 introduced [signing of backend plugins]({{< relref "../../plugins/plugin-signatures.md" >}}), community plugins won’t load by default if they’re unsigned.

To learn more, refer to [Backend plugins]({{< relref "backend" >}}).

### Migrate a plugin from Angular to React

If you’re looking to migrate a plugin to the new plugin platform, then we recommend that you release it under a new major version. Consider keeping a release branch for the previous version to be able to roll out patch releases for versions prior to Grafana 7.

While there's no 1-to-1 migration path from an Angular plugin to the new React platform, from early adopters, we’ve learned that one of the easiest ways to migrate is to:

1. Create a new branch called `migrate-to-react`.
1. Start from scratch with one of the templates provided by Grafana Toolkit.
1. Move the existing code into the new plugin incrementally, one component at a time.

#### Migrate a panel plugin

Prior to Grafana 7.0, you would export a MetricsPanelCtrl from module.ts.

**src/module.ts**

```ts
import { MetricsPanelCtrl } from 'grafana/app/plugins/sdk';

class MyPanelCtrl extends MetricsPanelCtrl {
  // ...
}

export { MyPanelCtrl as PanelCtrl };
```

Starting with 7.0, plugins now export a PanelPlugin from module.ts where MyPanel is a React component containing the props from PanelProps.

**src/module.ts**

```ts
import { PanelPlugin } from '@grafana/data';

export const plugin = new PanelPlugin<MyOptions>(MyPanel);
```

**src/MyPanel.tsx**

```ts
import { PanelProps } from '@grafana/data';

interface Props extends PanelProps<SimpleOptions> {}

export const MyPanel: React.FC<Props> = ({ options, data, width, height }) => {
  // ...
};
```

#### Migrate a data source plugin

While all plugins are different, we'd like to share a migration process that has worked for some of our users.

1. Define your configuration model and `ConfigEditor`. For many plugins, the configuration editor is the simplest component so it's a good candidate to start with.
1. Implement the `testDatasource()` method on the class that extends `DataSourceApi` using the settings in your configuration model to make sure you can successfully configure and access the external API.
1. Implement the `query()` method. At this point, you can hard-code your query, because we haven’t yet implemented the query editor. The `query()` method supports both the new data frame response and the old TimeSeries response, so don’t worry about converting to the new format just yet.
1. Implement the `QueryEditor`. How much work this requires depends on how complex your query model is.

By now, you should be able to release your new version.

To fully migrate to the new plugin platform, convert the time series response to a data frame response.

#### Migrate to data frames

Before 7.0, data source and panel plugins exchanged data using either time series or tables. Starting with 7.0, plugins use the new data frame format to pass data from data sources to panels.

Grafana 7.0 is backward compatible with the old data format used in previous versions. Panels and data sources using the old format will still work with plugins using the new data frame format.

The `DataQueryResponse` returned by the `query` method can be either a [LegacyResponseData](https://grafana.com/docs/grafana/latest/packages_api/data/legacyresponsedata/) or a [DataFrame](https://grafana.com/docs/grafana/latest/packages_api/data/dataframe/).

The [toDataFrame()](https://grafana.com/docs/grafana/latest/packages_api/data/todataframe/) function converts a legacy response, such as `TimeSeries` or `Table`, to a `DataFrame`. Use it to gradually move your code to the new format.

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

For more information, refer to [Data frames]({{< relref "data-frames.md">}}).

### Troubleshoot plugin migration

As of Grafana 7.0, backend plugins can now be cryptographically signed to verify their origin. By default, Grafana ignores unsigned plugins. For more information, refer to [Allow unsigned plugins]({{< relref "../../plugins/plugin-signatures.md#allow-unsigned-plugins" >}}).
