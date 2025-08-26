---
aliases:
  - ../../features/panels/datagrid_panel/
  - ../../reference/datagrid/
  - ../../visualizations/datagrid/
description: Configure options for Grafana's datagrid visualization
keywords:
  - grafana
  - dashboard
  - panels
  - datagrid
  - datagrid panel
  - datagrid options
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Datagrid
title: Datagrid
weight: 100
refs:
  special-data-sources:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/#special-data-sources
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/connect-externally-hosted/data-sources/#special-data-sources
---

# Datagrid

{{< docs/experimental product="The datagrid visualization" featureFlag="`enableDatagridEditing`" >}}

Datagrids offer you the ability to create, edit, and fine-tune data within Grafana. As such, this panel can act as a data source for other panels
inside a dashboard.

{{< figure src="/media/docs/grafana/panels-visualizations/screenshot-datagrid-visualization-v12.0.png" max-width="750px" alt="The datagrid visualization" >}}

Through it, you can manipulate data queried from any data source, you can start from a blank slate, or you can pull data from a dragged and dropped file.
You can then use the panel as a simple tabular visualization, or you can modify the data—and even remove it altogether—to create a blank slate.

Editing the dataset changes the data source to use the inbuilt `-- Grafana --` data source, thus replacing the old data source settings and related queries, while also copying the current dataset into the dashboard model.

You can then use the panel as a data source for other panels, by using the inbuilt `-- Dashboard --` data source to pull the datagrid data.
This allows for an interactive dashboard experience, where you can modify the data and see the changes reflected in other panels.

Learn more about the inbuilt `-- Grafana --` and `-- Dashboard --` data sources in the [special data sources](ref:special-data-sources) documentation.

## Context menu

To provide a more streamlined experience, the datagrid has a context menu that can be accessed by right-clicking on a cell, column header, or row selector. Depending on the state of your datagrid, the context menu offers different options including:

- Delete or clear rows and columns.
- Remove all existing data (rendering your datagrid blank).
- Trigger search functionality, which allows you to find keywords within the dataset.

Deleting a row or column will remove the data from the datagrid, while clearing a row or column will only remove the data from the cells, leaving the row or column intact.

{{< figure src="/media/docs/datagrid/screenshot-grafana-datagrid-context-menu-2.png" alt="Datagrid context menu" max-width="400px" >}}

### Header menu

You can also access a header menu by clicking the dropdown icon next to the header title. From here, you can not only delete or clear a column, but also rename it, freeze it, or convert the field type of the column.

{{< figure src="/media/docs/grafana/panels-visualizations/screenshot-datagrid-header-menu-v12.0.png" alt="Datagrid header menu" max-width="400px" >}}

## Use datagrids

Datagrids offer various ways of interacting with your data. You can add, edit, move, clear, and remove rows and columns; use the inbuilt search functionality to find specific data; and convert field types or freeze horizontal scroll on a specific column.

### Add data

You can add data to a datagrid by creating a new column or row.

To create a new column, follow these steps:

1. In an existing panel, click the **+** button in the table header after the last column.
1. When prompted, add a name for the new column.
1. Click anywhere outside the field or press the Enter key to save the column.

Now you can add data in each cell.

To add a new row, click a **+** button after the last row. The button is present in each cell after the last row, and clicking it triggers the creation of a new row while also activating the cell that you clicked.

### Edit data

To edit data, follow these steps:

1. Double-click on the cell that needs to be modified. This will activate the cell and allow you to edit the data.
1. After editing the data, click anywhere outside the cell or press the Enter key to finalize the edit.

To easily clear a cell of data, you can click on a cell to focus it and then press the Delete key.

### Move data

You can move columns and rows as needed.

To move a column, follow these steps:

1. Click and hold the header of the column that needs to be moved.
1. Drag the column to the desired location.
1. Release the mouse button to finalize the move.

To move a row, click and hold on the row selector from the number column situated on the far left side of the grid, and drag it to the desired location. Releasing the mouse button finalizes the move.

### Select multiple cells

You can select multiple cells by clicking on a single cell and dragging the mouse across others. This selection can be used to copy the data from the selected cells or to delete them using the Delete key.

### Delete/clear multiple rows or columns

To delete or clear multiple rows, follow these steps:

1. Hover over the number column (to the left of the first column in the grid) to display row checkbox.
1. Select the checkboxes for the rows you want to work with.
   To select multiple consecutive rows, press and hold the Shift key while clicking on the first and last row. To select non-consecutive rows, press and hold the Ctrl (or Cmd) key while clicking the desired rows.
1. Right-click to access the context menu.
1. Select **Delete rows** or **Clear rows**.

The same rules apply to columns by clicking the column headers.

To delete all rows, use the select all checkbox at the top left corner of the datagrid. This selects all rows and allows you to delete them using the context menu.

## Configuration options

{{< docs/shared lookup="visualizations/config-options-intro.md" source="grafana" version="<GRAFANA_VERSION>" >}}

### Panel options

{{< docs/shared lookup="visualizations/panel-options.md" source="grafana" version="<GRAFANA_VERSION>" >}}

### Datagrid options

If there are multiple series, you can choose the dataset the datagrid displays using the **Select series** option.
