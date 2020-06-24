+++
title = "Build a plugin"
type = "docs"
+++

# Build a plugin

For more information on the types of plugins you can build, refer to the [Plugin Overview]({{< relref "../../plugins/_index.md" >}}).

## Get started

The easiest way to start developing Grafana plugins is to use the [Grafana Toolkit](https://www.npmjs.com/package/@grafana/toolkit).

Open the terminal, and run the following command in your [plugin directory]({{< relref "../../administration/configuration.md#plugins" >}}):

```bash
npx @grafana/toolkit plugin:create my-grafana-plugin
```

If you want a more guided introduction to plugin development, check out our tutorials:

- [Build a panel plugin]({{< relref "../../../../../tutorials/build-a-panel-plugin.md" >}})
- [Build a data source plugin]({{< relref "../../../../../tutorials/build-a-data-source-plugin.md" >}})

## Go further

Learn more about specific areas of plugin development.

### Tutorials

If you're looking to build your first plugin, check out these introductory tutorials:

- [Build a panel plugin]({{< relref "../../../../../tutorials/build-a-panel-plugin.md" >}})
- [Build a data source plugin]({{< relref "../../../../../tutorials/build-a-data-source-plugin.md" >}})

Ready to learn more? Check out our other tutorials:

- [Build a panel plugin with D3.js]({{< relref "../../../../../tutorials/build-a-panel-plugin-with-d3.md" >}})

### Guides

Improve an existing plugin with one of our guides:

- [Add authentication for data source plugins]({{< relref "add-authentication-for-data-source-plugins" >}})
- [Add support for annotations]({{< relref "add-support-for-annotations.md" >}})
- [Add support for Explore queries]({{< relref "add-support-for-explore-queries.md" >}})
- [Add support for variables]({{< relref "add-support-for-variables.md" >}})
- [Build a logs data source plugin]({{< relref "build-a-logs-data-source-plugin.md" >}})
- [Build a streaming data source plugin]({{< relref "build-a-streaming-data-source-plugin.md" >}})

### Concepts

Deepen your knowledge through a series of high-level overviews of plugin concepts:

- [Data frames]({{< relref "data-frames.md" >}})

### UI library

Explore the many UI components in our [Grafana UI library](https://developers.grafana.com/ui).

### API reference

Learn more about Grafana options and packages.

#### Metadata

- [Plugin metadata]({{< relref "metadata.md" >}})

#### Typescript

- [Grafana Data]({{< relref "../../packages_api/data/_index.md" >}})
- [Grafana Runtime]({{< relref "../../packages_api/runtime/_index.md" >}})
- [Grafana UI]({{< relref "../../packages_api/ui/_index.md" >}})

#### Go

- [Grafana Plugin SDK for Go]({{< relref "backend/grafana-plugin-sdk-for-go" >}})
