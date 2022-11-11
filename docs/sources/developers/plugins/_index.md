---
aliases:
  - /docs/grafana/latest/developers/plugins/
  - /docs/grafana/latest/plugins/developing/
title: Build a plugin
description: Resources for creating Grafana plugins
weight: 200
---

# Build a plugin

For more information on the types of plugins you can build, refer to the [Plugin Overview]({{< relref "../../administration/plugin-management/" >}}).

## Get started

The easiest way to start developing Grafana plugins is to use the Grafana [create-plugin tool](https://www.npmjs.com/package/@grafana/create-plugin).

Open the terminal, and run the following command in your [plugin directory]({{< relref "../../setup-grafana/configure-grafana/#plugins" >}}):

```bash
npx @grafana/create-plugin
```

Follow the questions and you will have a starter plugin ready to develop.

If you want a more guided introduction to plugin development, check out our tutorials:

- [Build a panel plugin]({{< ref "build-a-panel-plugin.md" >}})
- [Build a data source plugin]({{< ref "build-a-data-source-plugin.md" >}})

## Go further

Learn more about specific areas of plugin development.

### Tutorials

If you're looking to build your first plugin, check out these introductory tutorials:

- [Build a panel plugin]({{< ref "build-a-panel-plugin.md" >}})
- [Build a data source plugin]({{< ref "build-a-data-source-plugin.md" >}})
- [Build a data source backend plugin]({{< ref "build-a-data-source-backend-plugin.md" >}})

Ready to learn more? Check out our other tutorials:

- [Build a panel plugin with D3.js]({{< ref "build-a-panel-plugin-with-d3.md" >}})

### Guides

Improve an existing plugin with one of our guides:

- [Add authentication for data source plugins]({{< relref "add-authentication-for-data-source-plugins/" >}})
- [Add support for annotations]({{< relref "add-support-for-annotations/" >}})
- [Add support for Explore queries]({{< relref "add-support-for-explore-queries/" >}})
- [Add support for variables]({{< relref "add-support-for-variables/" >}})
- [Add a query editor help component]({{< relref "add-query-editor-help/" >}})
- [Build a logs data source plugin]({{< relref "build-a-logs-data-source-plugin/" >}})
- [Build a streaming data source plugin]({{< relref "build-a-streaming-data-source-plugin/" >}})
- [Error handling]({{< relref "error-handling/" >}})
- [Working with data frames]({{< relref "working-with-data-frames/" >}})
- [Development with local Grafana]({{< relref "development-with-local-grafana/" >}})

### Concepts

Deepen your knowledge through a series of high-level overviews of plugin concepts:

- [Data frames]({{< relref "data-frames/" >}})

### UI library

Explore the many UI components in our [Grafana UI library](https://developers.grafana.com/ui).

### Examples

For inspiration, check out our [plugin examples](https://github.com/grafana/grafana-plugin-examples).

### Metadata

- [Plugin metadata]({{< relref "metadata/" >}})

### SDK

- [Grafana Plugin SDK for Go]({{< relref "backend/grafana-plugin-sdk-for-go/" >}})
