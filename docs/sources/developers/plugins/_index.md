---
aliases:
  - ../plugins/developing/
description: Resources for creating Grafana plugins
title: Build a plugin
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

- [Build a panel plugin](/tutorials/build-a-panel-plugin/)
- [Build a data source plugin](/tutorials/build-a-data-source-plugin/)

## Go further

Learn more about specific areas of plugin development.

### Tutorials

If you're looking to build your first plugin, check out these introductory tutorials:

- [Build a panel plugin](/tutorials/build-a-panel-plugin/)
- [Build a data source plugin](/tutorials/build-a-data-source-plugin/)
- [Build a data source backend plugin](/tutorials/build-a-data-source-backend-plugin/)

Ready to learn more? Check out our other tutorials:

- [Build a panel plugin with D3.js](/tutorials/build-a-panel-plugin-with-d3/)

### Guides

Improve an existing plugin with one of our guides:

- [Add authentication for data source plugins](/tutorials/add-authentication-for-data-source-plugins/)
- [Add support for annotations](/tutorials/add-support-for-annotations/)
- [Add support for Explore queries](/tutorials/add-support-for-explore-queries/)
- [Add support for variables](/tutorials/add-support-for-variables/)
- [Add a query editor help component](/tutorials/add-query-editor-help/)
- [Build a logs data source plugin](/tutorials/build-a-logs-data-source-plugin/)
- [Build a streaming data source plugin](/tutorials/build-a-streaming-data-source-plugin/)
- [Error handling](/tutorials/error-handling/)
- [Working with data frames](/tutorials/working-with-data-frames/)
- [Development with local Grafana](/tutorials/development-with-local-grafana/)

### Concepts

Deepen your knowledge through a series of high-level overviews of plugin concepts:

- [Data frames](/tutorials/data-frames/)

### UI library

Explore the many UI components in our [Grafana UI library](/ui).

### Examples

For inspiration, check out our [plugin examples](/grafana/grafana-plugin-examples).

### Metadata

- [Plugin metadata](/tutorials/metadata/)

### SDK

- [Grafana Plugin SDK for Go](/tutorials/backend/grafana-plugin-sdk-for-go/)
