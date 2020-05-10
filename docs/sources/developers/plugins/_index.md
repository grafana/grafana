+++
title = "Build a plugin"
type = "docs"
+++

# Build a plugin

For more information on the types of plugins you can build, refer to the [Plugin Overview]({{< relref "../../plugins/_index.md" >}}).

## Get started

The easiest way to start developing Grafana plugins is to use the [Grafana Toolkit](https://www.npmjs.com/package/@grafana/toolkit).

Open the terminal, and run the following command in your [plugin directory]({{< relref "../../installation/configuration/_index.md#plugins" >}}):

```bash
npx @grafana/toolkit plugin:create my-grafana-plugin
```

If you want a more guided introduction to plugin development, check out our tutorials:

- [Build a panel plugin]({{< relref "../../../../../tutorials/build-a-panel-plugin.md" >}})
- [Build a data source plugin]({{< relref "../../../../../tutorials/build-a-data-source-plugin.md" >}})

## Go further

Learn more about specific areas of plugin development.

### Concepts

Deepen your knowledge through a series of high-level overviews of plugin concepts.

- [Data frames]({{< relref "data-frames.md" >}})
- [Authentication for data source plugins]({{< relref "authentication.md" >}})

### UI library

Explore the many UI components in our [Grafana UI library](https://developers.grafana.com/ui).

### Tutorials

If you're looking to build your first plugin, check out these introductory tutorials:

- [Build a panel plugin]({{< relref "../../../../../tutorials/build-a-panel-plugin.md" >}})
- [Build a data source plugin]({{< relref "../../../../../tutorials/build-a-data-source-plugin.md" >}})

Ready to learn more? Check out our other tutorials:

- [Build a panel plugin with D3.js]({{< relref "../../../../../tutorials/build-a-panel-plugin-with-d3.md" >}})

### API reference

Learn more about Grafana options and packages.

#### Metadata

- [Plugin metadata]({{< relref "metadata.md" >}})

#### Typescript

- [Grafana Data]({{< relref "../../packages_api/data/_index.md" >}})
- [Grafana Runtime]({{< relref "../../packages_api/runtime/_index.md" >}})
- [Grafana UI]({{< relref "../../packages_api/ui/_index.md" >}})

#### Go

- [Grafana Plugin SDK](https://pkg.go.dev/mod/github.com/grafana/grafana-plugin-sdk-go?tab=overview)
