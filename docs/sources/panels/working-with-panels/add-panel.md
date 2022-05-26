---
aliases:
  - /docs/sources/panels/working-with-panels/add-panel/
title: Add a panel to a dashboard
weight: 20
---

# Add a panel to a dashboard

Panels allow you to show your data in visual form. Each panel needs at least one query to display a visualization.

## Before you begin

- Ensure that you have the proper [organization role]({{< relref "../../permissions/organization_roles.md" >}}) or [permissions]({{< relref "../../permissions/_index.md" >}}).
- Identify the dashboard to which you want to add the panel.
- Understand the query language of the target data source.
- Ensure that data source for which you are writing a query has been added. For more information about adding a data source, refer to [Add a data source]({{< relref "../../datasources/add-a-data-source.md" >}}) if you need instructions.

**To add a panel to a dashboard**:

1. Navigate to the dashboard to which you want to add a panel.
1. Click the **Add panel** icon.

   ![](/static/img/docs/panels/add-panel-icon-7-0.png)

1. Click **Add an empty panel**.

   Grafana creates an empty time-series panel and selects the default data source.

1. In the first line of the **Query** tab, click the drop-down list and select a data source.

1. Write or construct a query in the query language of your data source.

   For more information about data sources, refer to [Data sources]({{< relref "../../datasources/_index.md" >}}) for specific guidelines.

1. In the Visualization list, select a visualization type.

   Grafana displays a preview of your query results with the visualization applied.

   ![](/static/img/docs/panel-editor/select-visualization-8-0.png)

   For more information about individual visualizations, refer to [Visualizations options]({{< relref "../../visualizations/_index.md" >}}).

1. Refer to the following documentation for ways you adjust panel settings.

   While not required, most visualizations need some adjustment before they properly display the information that you need.

   - [Format data using value mapping]({{< relref "../format-data/about-value-mapping.md" >}})
   - [Visualization-specific options]({{< relref "../../visualizations/_index.md" >}})
   - [Override field values]({{< relref "../override-field-values/about-field-overrides.md" >}})
   - [Specify thresholds to set the color of visualization text and background]({{< relref "../specify-thresholds/about-thresholds.md" >}})
   - [Apply color to series and fields]({{< relref "./apply-color-to-series.md" >}})

1. Add a note to describe the visualization (or describe your changes) and then click **Save** in the upper-right corner of the page.

   Notes can be helpful if you need to revert the dashboard to a previous version.
