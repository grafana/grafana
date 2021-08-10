+++
title = "Transformations"
weight = 350
+++

# Transformations

Transformations process the result set of a query before it’s passed on for visualization. They allow you to rename fields, join separate time series together, do math across queries, and more. For users, with numerous dashboards or with a large volume of queries, the ability to reuse the query result from one panel in another panel can be a huge performance gain.

The transformations feature is accessible from the **Transform** tab of the Grafana panel editor.

Transformations sometimes result in data that cannot be graphed. When that happens, click the `Table view` toggle above the visualization to switch to a table view of the data. This can help you understand
the final result of your transformations.

## Order of transformations

In case there are multiple transformations, Grafana applies them in the exact sequence in which they are listed. Each transformation creates a new result set that is passed onto the next transformation in the pipeline for processing.

The order in which transformations are applied can make a huge difference in how your results look. For example, if you use a Reduce transformation to condense all the results of one column into a single value, then you can only apply transformations to that single value.

## Prerequisites

Before you can configure and apply transformations:

- You must have entered a query that return data. For more information on queries, refer to [Queries]({{< relref "../queries.md" >}}).

## List of transformations

- [Add field from calculation]({{< relref "./types-options.md#add-field-from-calculation" >}})
- [Concatenate fields]({{< relref "./types-options.md#concatenate-fields" >}})
- [Config from query results]({{< relref "./config-from-query.md" >}})
- [Filter data by name]({{< relref "./types-options.md#filter-data-by-name" >}})
- [Filter data by query]({{< relref "./types-options.md#filter-data-by-query" >}})
- [Filter data by value]({{< relref "./types-options.md#filter-data-by-value" >}})
- [Group by]({{< relref "./types-options.md#group-by" >}})
- [Labels to fields]({{< relref "./types-options.md#labels-to-fields" >}})
- [Merge]({{< relref "./types-options.md#merge" >}})
- [Organize fields]({{< relref "./types-options.md#organize-fields" >}})
- [Outer join]({{< relref "./types-options.md#join-by-field-outer-join" >}})
- [Reduce]({{< relref "./types-options.md#reduce" >}})
- [Rename by regex]({{< relref "./types-options.md#rename-by-regex" >}})
- [Rows to fields]({{< relref "./rows-to-fields" >}})
- [Series to rows]({{< relref "./types-options.md#series-to-rows" >}})
- [Sort by]({{< relref "./types-options.md#sort-by" >}})
