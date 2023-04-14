---
title: Add support for annotations
---

# Add support for annotations

This guide explains how to add support for [annotations]({{< relref "../../dashboards/build-dashboards/annotate-visualizations" >}}) to an existing data source plugin.

This guide assumes that you're already familiar with how to [Build a data source plugin](/tutorials/build-a-data-source-plugin/).

> **Note:** Annotation support for React plugins was released in Grafana 7.2. To support earlier versions, refer to [Add support for annotation for Grafana 7.1](https://grafana.com/docs/grafana/v7.1/developers/plugins/add-support-for-annotations/).

## Add annotations support to your data source

To enable annotation support for your data source, add the following two lines of code. Grafana uses your default query editor for editing annotation queries.

1. Add `"annotations": true` to the [plugin.json]({{< relref "metadata/" >}}) file to let Grafana know that your plugin supports annotations.

   **plugin.json**

   ```json
   {
     "annotations": true
   }
   ```

2. In `datasource.ts`, override the `annotations` property from `DataSourceApi` (or `DataSourceWithBackend` for backend data sources). For the default behavior, you can set `annotations` to an empty object.

   **datasource.ts**

   ```ts
   annotations: {
   }
   ```
