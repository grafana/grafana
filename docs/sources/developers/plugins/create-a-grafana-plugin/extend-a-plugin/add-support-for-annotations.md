---
title: Enable annotations
menuTitle: Enable annotations
aliases:
  - ../../../plugins/add-support-for-annotations/
description: Add support for annotations in your plugin.
keywords:
  - grafana
  - plugins
  - plugin
  - annotations
weight: 100
---

# Enable annotations

You can add support to your plugin for annotations that will insert information into Grafana alerts. This guide explains how to add support for [annotations]({{< relref "../../../../dashboards/build-dashboards/annotate-visualizations#querying-other-data-sources" >}}) to a data source plugin.

## Support annotations in your data source plugin

To enable annotations, simply add two lines of code to your plugin. Grafana uses your default query editor for editing annotation queries.

1. Add `"annotations": true` to the [plugin.json]({{< relref "../../metadata.md" >}}) file to let Grafana know that your plugin supports annotations.

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
