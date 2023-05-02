---
title: Add support for annotations
---

# Add support for annotations

Plugin developers add support for annotations to insert supplemental information into Grafana alerts. This guide explains how to add support for [annotations]({{< relref "../../dashboards/build-dashboards/annotate-visualizations" >}}) to a data source plugin.

## Before you begin

This guide assumes that you're already familiar with how to [build a data source plugin](/tutorials/build-a-data-source-plugin/).

## Support annotations in your data source plugin

To enable annotations, simply add two lines of code to your plugin. Grafana uses your default query editor for editing annotation queries.

1. Add `"annotations": true` to the [plugin.json]({{< relref "metadata/" >}}) file to let Grafana know that your plugin supports annotations.

   **In `plugin.json`:**

   ```json
   {
     "annotations": true
   }
   ```

2. In `datasource.ts`, override the `annotations` property from `DataSourceApi` (or `DataSourceWithBackend` for backend data sources). For the default behavior, set `annotations` to an empty object.

   **In `datasource.ts`:**

   ```ts
   annotations: {
   }
   ```
