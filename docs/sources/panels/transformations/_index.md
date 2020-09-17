+++
ttitle = "Transformations"
type = "docs"
[menu.docs]
identifier = "transformations"
parent = "panels"
weight = 300
+++

# Transformations

This topic explains in detail how to use the transformations feature in Grafana.

> **Note:** Transformations is a Grafana 7.0 beta feature. This topic will be frequently updated to reflect updates to the feature.

Transformations process the result set before it’s passed to the visualization. They allow you to rename fields, join separate time series together, do math across queries, and more. For users, with numerous dashboards or with a large volume of queries, the ability to reuse the query result from one panel in another panel can be a huge performance gain.

> **Note:** Transformations sometimes result in data that cannot be graphed. When that happens, Grafana displays a suggestion on the visualization that you can click to switch to table visualization. This often helps you better understand what the transformation is doing to your data.

## Access

The transformations feature is accessible from the Transform tab of the Grafana panel editor.
