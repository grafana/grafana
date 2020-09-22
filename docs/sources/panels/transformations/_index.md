+++
title = "Overview"
type = "docs"
[menu.docs]
identifier = "overview"
parent = "transformations"
weight = 300
+++

# Transformations overview

Transformations process the result set of a query before it’s passed on for visualization. They allow you to rename fields, join separate time series together, do math across queries, and more. For users, with numerous dashboards or with a large volume of queries, the ability to reuse the query result from one panel in another panel can be a huge performance gain.

The transformations feature is accessible from the **Transform** tab of the Grafana panel editor.

> **Note:** Transformations is a Grafana 7.0 beta feature. Topics in this section will be frequently updated as we work on this feature.

Transformations sometimes result in data that cannot be graphed. When that happens, Grafana displays a suggestion on the visualization that you can click to switch to table visualization. This often helps you better understand what the transformation is doing to your data.

## Order of transformations

In case there are multiple transformations, Grafana applies them in the exact sequence in which they are listed. Each transformation creates a new result set that is passed onto the next transformation in the pipeline for processing.

The order in which transformations are applied can make a huge difference in how your results look. For example, if you use a Reduce transformation to condense all the results of one column into a single value, then you can only apply transformations to that single value.

## Prerequisites

Before you can configure and apply transformations:

- You must have entered a query and returned data from a data source. For more information on queries, refer to [Queries]({{< relref "../queries.md" >}}).
  
- You must have applied a visualization that supports queries. Examples are:
  - [Bar gauge]({{< relref "../visualizations/bar-gauge-panel.md" >}})
  - [Gauge]({{< relref "../visualizations/gauge-panel.md" >}})
  - [Graph]({{< relref "../visualizations/graph-panel.md" >}})
  - [Heatmap]({{< relref "../visualizations/heatmap.md" >}})
  - [Logs]({{< relref "../visualizations/logs-panel.md" >}})
  - [Stat]({{< relref "../visualizations/stat-panel.md" >}})
  - [Table]({{< relref "../visualizations/table-panel.md" >}})