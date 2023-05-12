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
weight: 950
---

# Datagrid

The datagrid panel offers a user the ability to create or edit and fine-tune data within Grafana. As such, this panel can act as a data source for other panels
inside a dashboard. Let us dive deeper into the flows and functionalities of this panel.

INSERT GENERAL DATAGRID IMG HERE

## Use cases

The datagrid panel can be used to manipulate data queried from any data source or pulled from a dragged and dropped file. It can then be used as a simple tabular
visualization or the data can be modified or even removed alltogether to create a blank slate. Any changes made to data source retrieved data trigger a confirmation modal that informs the user about the action they are about to take. Editing the dataset changes the data source to use the inbuilt `-- Grafana --` data source, thus losing the old data source setting and related queries, while also copying the current dataset into the dashboards model. After confirming the action, all data modifications are saved to the dashboard model.

The panel can then be used as a data source for other panels, by using the inbuilt `-- Dashboard --` data source to pull the datagrid data. This allows for an interactive dashboard experience, where the user can modify the data and see the changes reflected in other panels.

INSERT GIF OF DATA MODIFYING IRL

## Selecting series

If multiple series are present, the datagrid can display the preferred dataset through the panel options `Select series` select box.

## How to use the datagrid

Datagrid offers various ways of interacting with the data. The user can add, edit, move, clear and remove rows and columns, as well as use the inbuilt search functionality to find specific data, convert field types or freeze horizontal scroll on a specific column.

### Adding data

Data can be added to the datagrid by creating a new column or row. To create a new column, click the `+` button found after the last column. After clicking the button, a new input will prompt the user to name the newly created column. Clicking anywhere outside the input or pressing the `Enter` key will finalize column creation. After that, data can be filled on each cell.

To add a new row, click the `+` button found after the last row. The button is present on each cell after the last row and will trigger creating a new one while also activating the corresponding cell that was clicked.

### Editing data

Data can be edited by double clicking on the cell that needs to be modified. This will activate the cell and allow the user to edit the data. After editing the data, clicking anywhere outside the cell or pressing the `Enter` key will finalize the edit. To easily clear a cell of data, a user can click on a cell to focus it and then press the `Delete` key.

### Moving data

Columns and rows can be moved around as desired. To move a column, click and hold the column header and drag it to the desired location. Releasing the mouse button will finalize the move. To move a row, click and hold the row selector from the number column situated on the left side and drag it to the desired location. Releasing the mouse button will finalize the move.

### Selecting multiple cells

A user can select multiple cells by clicking on a one and dragging the mouse across others. This selection can be used to copy the data from the selected cells or to delete them using the `Delete` key.

### Using the context menu

To provide a more streamlined experience, the datagrid panel offers a context menu that can be accessed on right click. Based on the state of the datagrid, the context menu will offer different options. The context menu can be accessed by right clicking on a cell, column header or row selector. Through the context menu, users can delete or clear rows and column, remove all existing data, rendering the datagrid blank, or trigger the search functionality. Deleting a row or column will remove the data from the datagrid, while clearing a row or column will only remove the data from the cells, leaving the row or column intact.

INSERT PIC OF CONTEXT MENU

### Deleting/clearing multiple rows or columns

To delete or clear multiple rows, users can select the desired rows through the checkboxes found on the left side number column and then right click to access the context menu. To select multiple consecutive rows, keep the `Shift` key pressed while clicking on the first and last row. To select certain rows, keep the `Ctrl` (or `Cmd`) key pressed while clicking on the desired rows. The same can be done for columns, by clicking on the column headers and holding the `Shift` or `Ctrl` (`Cmd`) keys and then opening the context menu to apply the desired action.

To delete all rows, use the `Select all` checkbox found on the top left corner of the datagrid. This will select all rows and allow the user to delete them through the context menu.

INSERT PIC OF MULTIPLE SELECTS

### Searching data

The search functionality can be triggered from the context menu and will allow users to find keywords within the dataset. The searchbox can then be closed either by clicking the `x` button or pressing te `Escape` key.

### Header dropdown menu

There is another type of menu dedicated to the headers. Clicking on the dropdown icon on the right side of the header title will open a new menu from which you can also delete or clear a column, but also rename it, set it as freeze index not allowing columns until it to scroll vertically or convert the field type of the column.
Columns can be converted between `numeric`, `string` and `boolean` types.

INSERT PIC OF HEADER DROPDOWN
