+++
title = "Add a panel"
weight = 100
+++

# Add a panel

Panels allow you to show your data in visual form. This topic walks you through the most basic steps to build a panel.

## 1. Add a panel to a dashboard

1. Navigate to the dashboard you want to add a panel to.
1. Click the **Add panel** icon.

   ![](/static/img/docs/panels/add-panel-icon-7-0.png)

1. Click **Add an empty panel**.

Grafana creates an empty time series panel with your default data source selected.

## 2. Write a query

Each panel needs at least one query to display a visualization. You write queries in the Query tab of the panel editor. For more information about the Query tab, refer to [Queries]({{< relref "queries.md" >}}).

1. Choose a data source. In the first line of the Query tab, click the drop-down list to see all available data sources. This list includes all data sources you added. Refer to [Add a data source]({{< relref "../datasources/add-a-data-source.md" >}}) if you need instructions.
1. Write or construct a query in the query language of your data source. Options will vary. Refer to your specific [data source documentation]({{< relref "../datasources/_index.md" >}}) for specific guidelines.

## 3. Choose a visualization type

In the Visualization list, click a visualization type. Grafana displays a preview of your query results with that visualization applied.

![](/static/img/docs/panel-editor/select-visualization-8-0.png)

For more information about individual visualizations, refer to [Visualizations options]({{< relref "visualizations/_index.md" >}}).

## 4. (Optional) Edit panel settings

While not required, most visualizations need some adjustment before they properly display the information that you need. Options are defined in the linked topics below.

- [Panel options]({{< relref "./panel-options.md" >}})
- [Visualization-specific options]({{< relref "./visualizations/_index.md" >}})
- [Standard options]({{< relref "./standard-options.md" >}})
- [Thresholds]({{< relref "./thresholds.md" >}})
- [Value mappings]({{< relref "./value-mappings.md" >}})
- [Data links]({{< relref "../linking/data-links.md" >}})
- [Override fields]({{< relref "field-options/configure-specific-fields.md" >}})

## 5. Apply changes and save

Save the dashboard. Either press Ctrl/Cmd+S or click **Save** in the upper right corner of the screen.

Your options vary depending on the changes you made and whether or not it is a new dashboard. We recommend you add a note to describe your changes before you click **Save**. Notes are very helpful if you need to revert the dashboard to a previous version.

## What next?

Our Grafana Fundamentals tutorial is a great place to start, or you can learn more about Grafana by reading one of the documentation topics linked below:

- Learn more about [panel editor]({{< relref "panel-editor.md" >}}) options.
- Add more [queries]({{< relref "queries.md" >}}).
- [Transform]({{< relref "transformations/_index.md" >}}) your data.
- Set up an [alert]({{< relref "../alerting/_index.md" >}}).
- Create [templates and variables]({{< relref "../variables/_index.md" >}}).
