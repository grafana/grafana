title = "Transformations"
type = "docs"
[menu.docs]
identifier = "transformations"
parent = "panels"
weight = 300
+++

# Transformations

> **Note:** This documentation refers to a Grafana 7.0 beta feature.

This page explains what transformations in Grafana are and how to use them.

Transformations process the result set before it’s passed to the visualization. You access transformations in the Transform tab of the Grafana panel editor.

Transformations allow you to rename fields, join separate time series together, do math across queries, and more. For users\, with large dashboards or with heavy queries, being able to reuse the query result from one panel in another panel can be a huge performance gain.

> **Note:** Transformations sometimes result in data that cannot be graphed. When that happens, Grafana displays a suggestion on the visualization that you can click to switch to table visualization. This often helps you better understand what the transformation is doing to your data.

## Prerequisites

Before you apply transformations, all of the following must be true:
- You have entered a query and returned data from a data source. For more information about queries, refer to [Queries](ADD LINK TO QUERIES.MD).
- You have applied a visualization that supports queries, such as:
  - Graph
  - Stat
  - Gauge
  - Bar gauge
  - Table
  - Heatmap
  - Logs

## Types of Transformations

Grafana comes with the following transformations:
Reduce - Reduce all rows or data points to a single value using a function like max, min, mean, or last.
Filter by name - Filter a result set’s fields by name. This might be useful when you want to show only part of your result set.
Filter by query - Filter a result set by the refId of the query. This might be useful when your result set consists of multiple time series and you want to show only some of them.
Organize fields - Order, filter, and rename the fields in a result set. This transformation is useful when your result set contains for instance non human-readable field names or when you want to display a table and alter the order of the columns. 
Join by field - Join multiple time series from a result set by field.
Add field from calculation - Create new fields that are the result of result set row calculation.
Labels to fields - Group a series by time and return labels as fields.


