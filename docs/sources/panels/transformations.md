+++
title = "Transformations"
type = "docs"
[menu.docs]
identifier = "transformations"
parent = "panels"
weight = 300
+++

# Transformations

> **Note:** This documentation refers to a Grafana 7.0 beta feature. This documentation will be frequently updated to reflect updates to the feature, and it will probably be broken into smaller sections when the feature moves out of beta.

This page explains what transformations in Grafana are and how to use them.

Transformations process the result set before it’s passed to the visualization. You access transformations in the Transform tab of the Grafana panel editor.

Transformations allow you to rename fields, join separate time series together, do math across queries, and more. For users\, with large dashboards or with heavy queries, being able to reuse the query result from one panel in another panel can be a huge performance gain.

> **Note:** Transformations sometimes result in data that cannot be graphed. When that happens, Grafana displays a suggestion on the visualization that you can click to switch to table visualization. This often helps you better understand what the transformation is doing to your data.

## Transformation execution order

Grafana applies transformations in the sequence that they are listed on the screen. Every transformation creates a new result set that is passed to the next transformation in the pipeline.

The order can make a huge difference in how your results look. For example, if you use a Reduce transformation to condense all the results of one column to a single value, then you can only apply transformations to that single value.

## Prerequisites

Before you apply transformations, all of the following must be true:

- You have entered a query and returned data from a data source. For more information about queries, refer to [Queries]({{< relref "queries.md" >}}).
- You have applied a visualization that supports queries, such as:
  - Graph
  - Stat
  - Gauge
  - Bar gauge
  - Table
  - Heatmap
  - Logs

## Apply a transformation

Transformations are available from the Transform tab in the bottom pane of the Panel Editor, next to the Queries tab.

1. Navigate to the panel that you want to add transformations, click the panel title and then click **Edit**.
1. Click the **Transform** tab.
1. Click a transformation to select it. 
  
   A transformation row appears that allows you to configure the transformation options.

   Click **Add transformation** to apply another transformation. Keep in mind that the next transformation acts on the result set returned by the previous transformation.

   If you have trouble, click the bug icon to [debug your transformations](#debug-transformations).

   Click the trash can icon to permanently remove a transformation.

{{< docs-imagebox img="/img/docs/transformations/transformations-7-0.png" class="docs-image--no-shadow" max-width= "1000px" >}}

## Transformation types and options

Grafana comes with the following transformations:

- Reduce - Reduce all rows or data points to a single value using a function like max, min, mean, or last.
- Filter by name - Filter a result set’s fields by name. This might be useful when you want to show only part of your result set.
- Filter by query - Filter a result set by the refId of the query. This might be useful when your result set consists of multiple time series and you want to show only some of them.
- Organize fields - Order, filter, and rename the fields in a result set. This transformation is useful when your result set contains for instance non human-readable field names or when - you want to display a table and alter the order of the columns. 
- Join by field - Join multiple time series from a result set by field.
- Add field from calculation - Create new fields that are the result of result set row calculation.
- Labels to fields - Group a series by time and return labels as fields.

Keep reading for detailed descriptions of each type of transformation and the options available for each, as well as suggestions for how to use them.

### Reduce

Apply a _Reduce_ transformation when you want to simplify your results down to one value. Reduce basically removes time component. If visualized as a table, it reduces a column down to one row (value).

In the **Calculations** field, enter one or more calculation types. Click to see a list of calculation choices. For information about available calculations, refer to the [Calculation list]({{< relref "calculations-list.md" >}}).

Once you select at least one calculation, Grafana reduces the results down to one value using the calculation you select. If you select more than one calculation, then more than one value is displayed.

Here's an example of a table with time series data. Before I apply the transformation, you can see all the data organized by time.

{{< docs-imagebox img="/img/docs/transformations/reduce-before-7-0.png" class="docs-image--no-shadow" max-width= "1000px" >}}

After I apply the transformation, there is no time value and each column has been reduced to one row showing the results of the calculations that I chose.

{{< docs-imagebox img="/img/docs/transformations/reduce-after-7-0.png" class="docs-image--no-shadow" max-width= "1000px" >}}

## Debug transformations

To see the input and the output result sets of the transformation, click the bug icon on the right side of the transformation row.

Grafana displays the transformation debug view below the transformation row.

{{< docs-imagebox img="/img/docs/transformations/debug-transformations-7-0.png" class="docs-image--no-shadow" max-width= "1000px" >}}
