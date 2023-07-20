---
aliases:
  - ../../visualizations/flame-graph/
keywords:
  - grafana
  - dashboard
  - documentation
  - panels
  - flame graph
labels:
  products:
    - cloud
    - enterprise
    - oss
title: Flame graph
weight: 850
---

# Flame graph panel

Flame graph panel is a visualization that allows you to visualize profiling data. It can represent the profile as a flame graph, table or both

![<Flame graph panel>](/media/docs/grafana/panels-visualizations/flamegraph/screenshot-flamegraph-10.1.png)

## Flame graph

The flame graph takes advantage of the hierarchical nature of profiling data. It condenses data into a format that allows you to easily see which code paths are consuming the most system resources, for example, CPU time, allocated objects or space when measuring memory. Each block in the flame graph represents a function call in a stack and its width represents its value.

![<Flame graph>](/media/docs/grafana/panels-visualizations/flamegraph/screenshot-flamegraph-10.1-flamegraph.png)

Grayed-out sections are a set of functions that represent a relatively small value and were collapsed together into one section for performance reasons.

{{< figure src="/media/docs/grafana/panels-visualizations/flamegraph/screenshot-flamegraph-10.1-tooltip.png" max-width="500px" caption="Hover tooltip" >}}

You can hover over a specific function to view a tooltip that shows you what the additional data about that function, like function's value, function's % of total value, and the number of samples with that function.

### Dropdown actions

{{< figure src="/media/docs/grafana/panels-visualizations/flamegraph/screenshot-flamegraph-10.1-dropdown.png" max-width="500px" caption="Dropdown actions" >}}

You can click on a function to show a dropdown menu with additional actions.

#### Focus block

{{< figure src="/media/docs/grafana/panels-visualizations/flamegraph/screenshot-flamegraph-10.1-focus.png" max-width="500px" caption="Focus block" >}}

The focused block or function is set to 100% of the flame graph's width and all its children functions are shown with their widths updated relative to the width of the parent function, so you can better drill down into smaller parts of the flame graph.

#### Copy function name

This action copies the full name of the function that the block represents.

#### Sandwich view

{{< figure src="/media/docs/grafana/panels-visualizations/flamegraph/screenshot-flamegraph-10.1-sandwich.png" max-width="500px" caption="Sandwich view">}}
Sandwich view allows you to show the context of the clicked function. It shows all the function's callers on the top and all the callees to the bottom. This shows aggregated context of the function so if the function exists in multiple places in the flame graph, all the contexts are shown and aggregated in the sandwich view.

### Status bar

![<Status bar>](/media/docs/grafana/panels-visualizations/flamegraph/screenshot-flamegraph-10.1-status.png)
Status bar shows metadata about the flame graph and currently applied modifications like what part of the graph is focused or what function is shown in sandwich view. By clicking on X btton in the status bar pill you can remove the modification.

## Toolbar

### Search

![<Searching for function name>](/media/docs/grafana/panels-visualizations/flamegraph/screenshot-flamegraph-10.1-search.png)

You can use the search field to find functions with particular name. All the functions in the flame graph which match the search will remain colored, while the rest of the functions are grayed-out.

### Color schema picker

![<Different color scheme>](/media/docs/grafana/panels-visualizations/flamegraph/screenshot-flamegraph-10.1-color.png)

You can switch between coloring functions by their value or by their package name to visually tie functions from the same package together.

### Text align

Align text either to the left or to the right to show more important parts of the function name when it does not fit into the block.

### Visualization picker

You can choose to show only the flame graph, only table or both at the same time

## Top table

The top table shows the functions from the profile in a table format. The table has three columns: symbols, self, and total. The table is sorted by self time by default, but can be reordered by total time or symbol name by clicking the column headers. Each row represents aggregated values for the given function if the function appears in multiple places in the profile.

![Table view](/media/docs/grafana/panels-visualizations/flamegraph/screenshot-flamegraph-10.1-table.png)

There aer also action buttons on the left for each row. The first button searches for the function name while second button shows the sandwich view of the function.

## Data API

In order to render the flame graph, you must format the data frame data using a [nested set model](https://en.wikipedia.org/wiki/Nested_set_model).

A nested set model ensures each item of the flame graph is encoded just by its nesting level as an integer value, its metadata, and by its order in the data frame. This means that the order of items is significant and needs to be correct. The ordering is a depth-first traversal of the items in the flame graph which recreates the graph without needing variable-length values in the data frame like in a children's array.

Required fields:

| Field name | Type   | Description                                                                                                                |
| ---------- | ------ | -------------------------------------------------------------------------------------------------------------------------- |
| level      | number | The nesting level of the item. In other words how many items are between this item and the top item of the flame graph.    |
| value      | number | The absolute or cumulative value of the item. This translates to the width of the item in the graph.                       |
| label      | string | Label to be shown for the particular item.                                                                                 |
| self       | number | Self value which is usually the cumulative value of the item minus the sum of cumulative values of its immediate children. |
