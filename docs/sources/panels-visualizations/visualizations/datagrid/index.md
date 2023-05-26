---
aliases:
  - ../../features/panels/datagrid_panel/
  - ../../reference/datagrid/
  - ../../visualizations/datagrid/
description: Learn about datagrid panel visualization features.
keywords:
  - grafana
  - dashboard
  - panels
  - datagrid
  - datagrid panel
  - datagrid options
menuTitle: Datagrid
title: Datagrid
weight: 350
---

# Datagrid

{{% admonition type="note" %}}

The Grafana Datagrid panel is experimental. This feature is supported by the engineering team on a best-effort basis, and breaking changes may occur without notice prior to general availability.

{{% /admonition %}}

The Datagrid panel offers you the ability to create, edit, and fine-tune data within Grafana. As such, this panel can act as a data source for other panels
inside a dashboard.

Through it, you can manipulate data queried from any data source, or from a dragged and dropped file. You can then use the panel as a simple tabular
visualization, or you can modify the data—and even remove it altogether—to create a blank slate.

Editing the dataset changes the data source to use the inbuilt `-- Grafana --` data source, thus replacing the old data source settings and related queries, while also copying the current dataset into the dashboard model. You can either use a pre-existing dataset from any other data source, start with a blank slate, or you can drag and drop a file to create a new dataset.

You can then use the panel as a data source for other panels, by using the inbuilt `-- Dashboard --` data source to pull the datagrid data. This allows for an interactive dashboard experience, where you can modify the data and see the changes reflected in other panels.

Learn more about the inbuilt `-- Grafana --` and `-- Dashboard --` datasources in the [special data sources]({{< relref "../../../datasources/#special-data-sources"  >}}) documentation.

![Datagrid panel](/media/docs/datagrid/screenshot-grafana-datagrid-panel.png)

## Context menu

To provide a more streamlined experience, the Datagrid panel has a context menu that can be accessed by right clicking on a cell, column header, or row selector. Depending on the state of your datagrid, the context menu offers different options including:

- Delete or clear rows and columns.
- Remove all existing data (rendering your datagrid blank).
- Trigger search functionality, which allows you to find keywords within the dataset.

Deleting a row or column will remove the data from the datagrid, while clearing a row or column will only remove the data from the cells, leaving the row or column intact.

![Datagrid context menu](/media/docs/datagrid/screenshot-grafana-datagrid-context-menu.png)

## Header menu

You can also access a header menu by clicking the dropdown icon next to the header title. From here, you can not only delete or clear a column, but also rename it, freeze it, or convert the field type of the column.

![Datagrid header menu](/media/docs/datagrid/screenshot-grafana-datagrid-header-menu.png)

## Selecting series

If there are multiple series, you can set the Datagrid panel to display the preferred dataset using the **Select series** dropdown in the panel options.

## Using Datagrid

Datagrid offers various ways of interacting with your data. You can add, edit, move, clear, and remove rows and columns, as well as use the inbuilt search functionality to find specific data, convert field types, or freeze horizontal scroll on a specific column.

### Add data

You can add data to a datagrid by creating a new column or row.

To create a new column, take the following steps:

1. In an existing panel, click the **+** button after the last column.
1. When prompted, add a name for the new column.
1. Click anywhere outside the field or press the `Enter` key to save the column.

Now you can add data in each cell.

To add a new row, click the **+** button after the last row. The button is present on each cell after the last row and clicking it triggers the creation of a new row while also activating the corresponding cell that you clicked.

### Edit data

You can edit data by taking the following steps:

1. Double click on the cell that needs to be modified. This will activate the cell and allow you to edit the data.
1. After editing the data, click anywhere outside the cell or press the `Enter` key to finalize the edit.

To easily clear a cell of data, you can click on a cell to focus it and then press the `Delete` key.

### Move data

Columns and rows can be moved around as desired.

To move a column, take the following steps:

1. Click and hold the column header that needs to be moved.
1. Drag the column to the desired location.
1. Release the mouse button to finalize the move.

To move a row, click and hold on the row selector from the number column situated on the left side and drag it to the desired location. Releasing the mouse button will finalize the move.

### Select multiple cells

You can select multiple cells by clicking on a single cell and dragging the mouse across others. This selection can be used to copy the data from the selected cells or to delete them using the `Delete` key.

### Delete/clear multiple rows or columns

To delete or clear multiple rows:

1. Select the desired rows through the checkboxes found on the left side number column.
1. To select multiple consecutive rows, you must hold the `Shift` key pressed while clicking on the first and last row. To select certain rows, the `Ctrl` (or `Cmd`) key must be pressed while clicking on the desired rows.
1. Right click to access the context menu.
1. Select **Delete rows** or **Clear rows**.

Same rules apply to columns by clicking on the column headers.

To delete all rows, use the `Select all` checkbox found on the top left corner of the datagrid. This will select all rows and allow the user to delete them through the context menu.
