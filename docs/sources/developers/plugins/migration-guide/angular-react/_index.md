---
description: Guide for migrating plugins from AngularJS to React
keywords:
  - grafana
  - plugins
  - migration
  - plugin
  - documentation
title: Migrating plugins from AngularJS to React
menutitle: Angular to React
weight: 1000
---

# Migrate a plugin from AngularJS to React

If you want to migrate a plugin to Grafana's React-based plugin platform, then we recommend that you release it under a new major version. Consider keeping a release branch for the previous version to be able to roll out patch releases for versions prior to Grafana 7.

While there's no standard migration path from an Angular plugin to the new React platform, we’ve learned that one of the easiest ways to migrate is to:

1. Create a new branch called `migrate-to-react`.
1. Start from scratch with one of the templates provided by the [Create-plugin](https://www.npmjs.com/package/@grafana/create-plugin) tool.
1. Move the existing code into the new plugin incrementally, one component at a time.

## Migrate a panel plugin

Starting with Grafana 7.0, plugins export a `PanelPlugin` from `module.ts` where `MyPanel`is a React component containing the props from `PanelProps`.

**src/module.ts**

```ts
import { PanelPlugin } from '@grafana/data';

export const plugin = new PanelPlugin<MyOptions>(MyPanel);
```

**src/MyPanel.tsx**

```ts
import { PanelProps } from '@grafana/data';

interface Props extends PanelProps<SimpleOptions> {}

export function MyPanel({ options, data, width, height }: Props) {
  // ...
}
```

## Migrate a data source plugin

While all plugins are different, we'd like to share a migration process that has worked for some of our users.

1. Define your configuration model and `ConfigEditor`. For many plugins, the configuration editor is the simplest component so it's a good candidate to start with.
1. Implement the `testDatasource()` method on the class that extends `DataSourceApi`. Use the settings in your configuration model to make sure that you can successfully configure and access the external API.
1. Implement the `query()` method. At this point, you can hard-code your query, because we haven’t yet implemented the query editor. The `query()` method supports both the new data frame response and the old `TimeSeries` response, so don’t worry about converting to the new format just yet.
1. Implement the `QueryEditor`. How much work this requires depends on how complex your query model is.

By now, you should be able to release your new version.

To fully migrate to the new plugin platform, convert the time series response to a data frame response.
