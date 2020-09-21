+++
ttitle = "Overview"
type = "docs"
[menu.docs]
identifier = "overviewß"
parent = "tranformations"
weight = 300
+++

# Overview

Transformations process the result set before it’s passed on for visualization. They allow you to rename fields, join separate time series together, do math across queries, and more. For users, with numerous dashboards or with a large volume of queries, the ability to reuse the query result from one panel in another panel can be a huge performance gain.

The transformations feature is accessible from the **Transform** tab of the Grafana panel editor.

> **Note:** Transformations is a Grafana 7.0 beta feature. This topic along with the other topics in the Transformations section will be frequently updated to reflect updates to the feature.

Transformations sometimes result in data that cannot be graphed. When that happens, Grafana displays a suggestion on the visualization that you can click to switch to table visualization. This often helps you better understand what the transformation is doing to your data.

## Order of Transformations

In case there are multiple transformations, Grafana applies them in the exact sequence in which they are listed on the screen. Each transformation creates a new result set that is passed onto the next transformation in the pipeline for processing.

The order in which transformations are applied can make a huge difference in how your results look. For example, if you use a Reduce transformation to condense all the results of one column into a single value, then you can only apply transformations to that single value.