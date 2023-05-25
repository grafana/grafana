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

The Grafana Datagrid panel is Experimental. This feature is supported by the engineering team on a best-effort basis, and breaking changes may occur without notice prior to general availability.

{{% /admonition %}}

The Datagrid panel offers you the ability to create, edit, and fine-tune data within Grafana. As such, this panel can act as a data source for other panels
inside a dashboard. Let us dive deeper into the flows and functionalities of this panel.

![Datagrid panel](/media/docs/datagrid/screenshot-grafana-datagrid-panel.png)

## Use cases

The datagrid panel can be used to manipulate data queried from any data source, or from a dragged and dropped file. It can then be used as a simple tabular
visualization, or the data can be modified - and even removed altogether - to create a blank slate. Any changes made to data source retrieved data triggers a confirmation modal that informs you about the action you are about to take. Editing the dataset changes the data source to use the inbuilt `-- Grafana --` data source, thus losing the old data source settings and related queries, while also copying the current dataset into the dashboards model. After confirming the action, all data modifications are saved to the dashboard model.

The panel can then be used as a data source for other panels, by using the inbuilt `-- Dashboard --` data source to pull the datagrid data. This allows for an interactive dashboard experience, where you can modify the data and see the changes reflected in other panels.

To get a better understanding of the inbuilt `-- Grafana --` and `-- Dashboard --` datasources, please check the [special data sources](/docs/grafana/latest/datasources/#special-data-sources) documentation.

## Selecting series

If multiple series are present, the datagrid can display the preferred dataset through the panel options `Select series` select box.

## How to use the datagrid

Datagrid offers various ways of interacting with the data. You can add, edit, move, clear, and remove rows and columns, as well as use the inbuilt search functionality to find specific data, convert field types, or freeze horizontal scroll on a specific column.

### Adding data

Data can be added to the datagrid by creating a new column or row. To create a new column, click the `+` button found after the last column. After clicking the button, a new input will prompt you to name the newly created column. Clicking anywhere outside the input, or pressing the `Enter` key, will finalize column creation. After that, data can be filled on each cell.

To add a new row, click the `+` button found after the last row. The button is present on each cell after the last row and will trigger creating a new one while also activating the corresponding cell that was clicked.

### Editing data

Data can be edited by double clicking on the cell that needs to be modified. This will activate the cell and allow you to edit the data. After editing the data, clicking anywhere outside the cell or pressing the `Enter` key will finalize the edit. To easily clear a cell of data, you can click on a cell to focus it and then press the `Delete` key.

### Moving data

Columns and rows can be moved around as desired. To move a column, click and hold the column header and drag it to the desired location. Releasing the mouse button will finalize the move. To move a row, click and hold the row selector from the number column situated on the left side and drag it to the desired location. Releasing the mouse button will finalize the move.

### Selecting multiple cells

You can select multiple cells by clicking on a single cell and dragging the mouse across others. This selection can be used to copy the data from the selected cells or to delete them using the `Delete` key.

### Using the context menu

To provide a more streamlined experience, the datagrid panel offers a context menu that can be accessed on right mouse click. Based on the state of the datagrid, the context menu will offer different options. The context menu can be accessed by right mouse clicking on a cell, column header, or row selector. Through the context menu, you can delete or clear rows and columns, remove all existing data (rendering the datagrid blank), or trigger the search functionality. Deleting a row or column will remove the data from the datagrid, while clearing a row or column will only remove the data from the cells, leaving the row or column intact.

![Datagrid context menu](/media/docs/datagrid/screenshot-grafana-datagrid-context-menu.png)

### Deleting/clearing multiple rows or columns

To delete or clear multiple rows, you can select the desired rows through the checkboxes found on the left side number column and then right click to access the context menu. To select multiple consecutive rows, you must hold the `Shift` key pressed while clicking on the first and last row. To select certain rows, the `Ctrl` (or `Cmd`) key must be pressed while clicking on the desired rows. The same can be done for columns, by clicking on the column headers and holding the `Shift` or `Ctrl` (`Cmd`) keys and then opening the context menu to apply the desired action.

To delete all rows, use the `Select all` checkbox found on the top left corner of the datagrid. This will select all rows and allow the user to delete them through the context menu.

### Searching data

The search functionality can be triggered from the context menu and will allow you to find keywords within the dataset. The searchbox can then be closed either by clicking the `x` button or pressing the `Escape` key.

### Header dropdown menu

There is another type of menu dedicated to the headers. Clicking on the dropdown icon on the right side of the header title will open a new menu from which users can also delete or clear a column, but also rename it, freeze it, or convert the field type of the column.
Columns can be converted between `numeric`, `string` and `boolean` types.

![Datagrid header menu](/media/docs/datagrid/screenshot-grafana-datagrid-header-menu.png)
