---
aliases:
keywords:
  - grafana
  - dashboard
  - documentation
  - panels
  - flame graph
title: Flame graph
weight: 850
---

# Flame graph panel

> **Note:** This panel is currently in beta & behind the `flameGraph` feature toggle.

## Flame graph

The flame graph takes advantage of the hierarchical nature of profiling data. It condenses data into a format that allows you to easily see which code paths are consuming the most system resources.

These resources are measured through profiles which aggregate that information into a format which is then sent to the flame graph visualization. For example, allocated objects or space when measuring memory.

{{< figure src="/static/img/docs/flame-graph-panel/flame-graph.png" class="docs-image--no-shadow" max-width= "900px" caption="Figure 1 - Flame graph" >}}

Figure 1 illustrates what this data looks like when rendered. The top block is the root or parent of the other blocks, and represents the total of all of the profiles being measured. There may be one or more blocks for each row that is rendered below the total. Each of these blocks represents a child in the stack of function calls that originated from the original call to the root at the top of the flame graph.

Each block can have 0 or more siblings but can only have one parent.

In figure 1 we have many rows of colored blocks but also have grayed out sections which represent a set of blocks that represent a relatively short execution time and so were collapsed together into one section for performance reasons.

{{< figure src="/static/img/docs/flame-graph-panel/flame-graph-hovering.png" class="docs-image--no-shadow" max-width= "900px" caption="Figure 2 - Hovering over flame graph" >}}

As there is more information to a block other than just its label, we decided to hide this information by default and show it on hover.

Hovering over a specific block pops up a tooltip that shows you what the profile is measuring, in this case total time, along with other information such as this block's % of total time, the amount of time it took and the samples that were measured.

{{< figure src="/static/img/docs/flame-graph-panel/flame-graph-clicking.png" class="docs-image--no-shadow" max-width= "900px" caption="Figure 3 - Clicking on a block" >}}

As there may be multiple blocks per row, we may want to focus on a particular block in the row and its children only to further drill down the stack of function calls.

Clicking on a particular block will do just that, hiding the block's siblings. The clicked block is set to 100% of the flame graphs width and all its children blocks are now shown with their widths updated relative to their new parents width.

This process can be repeated to focus on finding the amount of resources that particular blocks and their children are consuming.

{{< figure src="/static/img/docs/flame-graph-panel/flame-graph-search.png" class="docs-image--no-shadow" max-width= "900px" caption="Figure 4 - Search" >}}

When you would like to quickly find the blocks with particular labels you can use the search field. Simply type in the label you want to search for and all of the blocks in the table with that text in their label will remain colored with all of the remaining blocks grayed out.

You can also click on any block or hover over it to narrow your search.

## Top table

The top table allows you to visualize which symbols take up the most resources in your profile.

The table has three columns, symbols, self and total - representing the self time and total time of each symbol. The table is sorted by self time by default, but can be reordered by total time or symbol name upon clicking the column headers.

{{< figure src="/static/img/docs/flame-graph-panel/top-table.png" class="docs-image--no-shadow" max-width= "900px" caption="Figure 5 - Top table" >}}

Clicking on a particular row of the top table will add that row's symbol to the search input which will search for that symbol in the flame graph.

Clicking on that top table row again will remove its symbol from the search input.

{{< figure src="/static/img/docs/flame-graph-panel/top-table-clicking.png" class="docs-image--no-shadow" max-width= "900px" caption="Figure 6 - Clicking on a top table row" >}}

Of course, sometimes you will not need to view both the top table and flame graph at the same time. This is especially true for large profiles.

In this case and if you only want to see the top table, you can click on the top table button to show only the top table.

3 options are available:

- Top Table: Only show the top table
- Flame Graph: Only show the flame graph
- Both: Show both the top table and flame graph

{{< figure src="/static/img/docs/flame-graph-panel/selected-view.png" class="docs-image--no-shadow" max-width= "900px" caption="Figure 7 - Show the top table / flame graph / both" >}}

## Data API

The flame graph expects a data frame data in a particular format to be able to render it. As the data is hierarchical while a data frame has a tabular structure, the way to encode it is to use a [nested set model](https://en.wikipedia.org/wiki/Nested_set_model).

In a simplified form it means each item of the flame graph is encoded just by its nesting level as an integer value, its metadata and by its order in the data frame. This means that the order of items is significant and needs to be correct. The ordering is depth first traversal of the items in the flame graph. This allows us to recreate the graph without needing variable length values in the data frame like children's array.

Required fields:

| Field name | Type   | Description                                                                                                                |
| ---------- | ------ | -------------------------------------------------------------------------------------------------------------------------- |
| level      | number | The nesting level of the item. In other words how many items are between this item and the top item of the flame graph.    |
| value      | number | The absolute or cumulative value of the item. This translates to the width of the item in the graph.                       |
| label      | string | Label to be shown for the particular item.                                                                                 |
| self       | number | Self value which is usually the cumulative value of the item minus the sum of cumulative values of its immediate children. |
