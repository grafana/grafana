---
aliases:
  - ../../features/panels/table_panel/
  - ../../panels/visualizations/table/filter-table-columns/
  - ../../reference/table/
  - ../../visualizations/table/
  - ../../visualizations/table/filter-table-columns/
  - /docs/grafana/next/panels/visualizations/table/table-field-options/
description: Configure options for Grafana's table visualization
keywords:
  - grafana
  - dashboard
  - panels
  - table panel
  - table options
  - format tables
  - table filter
  - filter columns
labels:
  products:
    - cloud
    - enterprise
    - oss
title: Table
weight: 100
refs:
  calculations:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/query-transform-data/calculation-types/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/panels-visualizations/query-transform-data/calculation-types/
  time-series-panel:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/visualizations/time-series/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/panels-visualizations/visualizations/time-series/
  time-series-to-table-transformation:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/query-transform-data/transform-data/#time-series-to-table-transform
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/panels-visualizations/query-transform-data/transform-data/#time-series-to-table-transform
  color-scheme:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/configure-standard-options/#color-scheme
    - pattern: /docs/grafana-cloud
      destination: /docs/grafana-cloud/visualizations/panels-visualizations/configure-standard-options/#color-scheme
  configuration-file:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/#configuration-file-location
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/#configuration-file-location
  field-override:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/configure-overrides/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/panels-visualizations/configure-overrides/
  data-transformation:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/query-transform-data/transform-data/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/panels-visualizations/query-transform-data/transform-data/
  build-query:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/query-transform-data/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/panels-visualizations/query-transform-data/
---

# Table

Tables are a highly flexible visualization designed to display data in columns and rows.
The table visualization can take multiple datasets and provide the option to switch between them.
With this versatility, it's the preferred visualization for viewing multiple data types, aiding in your data analysis needs.

![Basic table visualization](/media/docs/grafana/panels-visualizations/screenshot-basic-table-v11.3.png)

You can use a table visualization to show datasets such as:

- Common database queries like logs, traces, metrics
- Financial reports
- Customer lists
- Product catalogs

Any information you might want to put in a spreadsheet can often be best visualized in a table.

Tables also provide different styles to visualize data inside the table cells, such as colored text and cell backgrounds, gauges, sparklines, data links, JSON code, and images.

{{< admonition type="note" >}}
Annotations and alerts are not currently supported for tables.
{{< /admonition >}}

## Configure a table visualization

The following video provides a visual walkthrough of the options you can set in a table visualization.
If you want to see a configuration in action, check out the video:

{{< youtube id="PCY7O8EJeJY" >}}

{{< docs/play title="Table Visualizations in Grafana" url="https://play.grafana.org/d/OhR1ID6Mk/" >}}

## Supported data formats

The table visualization supports any data that has a column-row structure.

{{< admonition type="note" >}}
If you’re using a cell type such as sparkline or JSON, the data requirements may differ in a way that’s specific to that type. For more info refer to [Cell type](#cell-type).
{{< /admonition >}}

### Example

This example shows a basic dataset in which there's data for every table cell:

```csv
Column1, Column2, Column3
value1 , value2 , value3
value4 , value5 , value6
value7 , value8 , value9
```

If a cell is missing or the table column-row structure is not complete, as in the following example, the table visualization won’t display any of the data:

```csv
Column1, Column2, Column3
value1 , value2 , value3
gap1   , gap2
value4 , value5 , value6
```

If you need to hide columns, you can do so using [data transformations](ref:data-transformation), [field overrides](#field-overrides), or by [building a query](ref:build-query) that returns only the needed columns.

## Column filtering

You can temporarily change how column data is displayed using column filtering.
For example, you can show or hide specific values.

### Turn on column filtering

To turn on column filtering, follow these steps:

1. In Grafana, navigate to the dashboard with the table with the columns that you want to filter.
1. Hover over any part of the panel to which you want to add the link to display the actions menu on the top right corner.
1. Click the menu and select **Edit**.
1. In the panel editor pane, expand the **Table** options section.
1. Toggle on the [**Column filter** switch](#table-options).

A filter icon (funnel) appears next to each column title.

{{< figure src="/static/img/docs/tables/column-filter-with-icon.png" max-width="350px" alt="Column filtering turned on" class="docs-image--no-shadow" >}}

### Filter column values

To filter column values, follow these steps:

1. Click the filter icon (funnel) next to a column title.

   Grafana displays the filter options for that column.

   {{< figure src="/static/img/docs/tables/filter-column-values.png" max-width="300px" alt="Filter column values" class="docs-image--no-shadow" >}}

1. Click the checkbox next to the values that you want to display or click **Select all**.
1. Enter text in the search field at the top to show those values in the display so that you can select them rather than scroll to find them.
1. Choose from several operators to display column values:

   - **Contains** - Matches a regex pattern (operator by default).
   - **Expression** - Evaluates a boolean expression. The character `$` represents the column value in the expression (for example, "$ >= 10 && $ <= 12").
   - The typical comparison operators: `=`, `!=`, `<`, `<=`, `>`, `>=`.

1. Click the checkbox above the **Ok** and **Cancel** buttons to add or remove all displayed values to and from the filter.

### Clear column filters

Columns with filters applied have a blue filter displayed next to the title.

{{< figure src="/static/img/docs/tables/filtered-column.png" max-width="100px" alt="Filtered column" class="docs-image--no-shadow" >}}

To remove the filter, click the blue filter icon and then click **Clear filter**.

## Sort columns

Click a column title to change the sort order from default to descending to ascending.
Each time you click, the sort order changes to the next option in the cycle.
You can sort multiple columns by holding the `Shift` key and clicking the column name.

{{< figure src="/static/img/docs/tables/sort-descending.png" max-width="350px" alt="Sort descending" class="docs-image--no-shadow" >}}

## Dataset selector

If the data queried contains multiple datasets, a table displays a drop-down list at the bottom, so you can select the dataset you want to visualize.
This option is only available when you're editing the panel.

{{< figure src="/media/docs/grafana/panels-visualizations/screenshot-table-multi-dataset-v11.3.png" max-width="650px" alt="Table visualization with multiple datasets" >}}

## Configuration options

### Panel options

{{< docs/shared lookup="visualizations/panel-options.md" source="grafana" version="<GRAFANA_VERSION>" >}}

### Table options

| Option               | Description                                                                                                                                                                                                                                                                 |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Show table header    | Show or hide column names imported from your data source.                                                                                                                                                                                                                   |
| Cell height          | Set the height of the cell. Choose from **Small**, **Medium**, or **Large**.                                                                                                                                                                                                |
| Enable pagination    | Toggle the switch to control how many table rows are visible at once. When switched on, the page size automatically adjusts to the height of the table. This option doesn't affect queries.                                                                                 |
| Minimum column width | Define the lower limit of the column width, in pixels. By default, the minimum width of the table column is 150 pixels. For small-screen devices, such as mobile phones or tablets, reduce the value to `50` to allow table-based panels to render correctly in dashboards. |
| Column width         | Define a column width, in pixels, rather than allowing the width to be set automatically. By default, Grafana calculates the column width based on the table size and the minimum column width.                                                                             |
| Column alignment     | Set how Grafana should align cell contents. Choose from: **Auto** (default), **Left**, **Center**, or **Right**.                                                                                                                                                            |
| Column filter        | Temporarily change how column data is displayed. For example, show or hide specific values. For more information, refer to [Column filtering](#column-filtering).                                                                                                           |

### Table footer options

Toggle the **Show table footer** switch on and off to control the display of the footer.
When the toggle is switched on, you can use the table footer to show [calculations](ref:calculations) on fields.

After you activate the table footer, make selections for the following options:

- **Calculation** - The calculation that you want to apply.
- **Count rows** - This option is displayed if you select the **Count** calculation. If you want to show the number of rows in the dataset instead of the number of values in the selected fields, toggle on the **Count rows** switch.
- **Fields** - The fields to which you want to apply the calculation. Grafana applies the calculation to all numeric fields if you don't select a field.

### Cell options

Cell options allow you to control how data is displayed in a table.
The options are:

- [Cell type](#cell-type) - Control the default cell display settings.
- [Wrap text](#wrap-text) - Wrap text in the cell that contains the longest content in your table.
- [Cell value inspect](#cell-value-inspect) - Enables value inspection from table cells.

#### Cell type

By default, Grafana automatically chooses display settings.
You can override these settings by choosing one of the following cell types to control the default display for all fields.
Additional configuration is available for some cell types.

If you want to apply a cell type to only some fields instead of all fields, you can do so using the **Cell options > Cell type** field override.

| Cell type                                 | Description                                                                                                                                                                                                                                                                                                                                   |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Auto                                      | Automatically displays values with sensible defaults applied.                                                                                                                                                                                                                                                                                 |
| [Sparkline](#sparkline)                   | Shows values rendered as a sparkline.                                                                                                                                                                                                                                                                                                         |
| [Colored text](#colored-text)             | If thresholds are set, then the field text is displayed in the appropriate threshold color.                                                                                                                                                                                                                                                   |
| [Colored background](#colored-background) | If thresholds are set, then the field background is displayed in the appropriate threshold color.                                                                                                                                                                                                                                             |
| [Gauge](#gauge)                           | Cells can be displayed as a graphical gauge, with several different presentation types. You can set the [Gauge display mode](#gauge-display-mode) and the [Value display](#value-display) options.                                                                                                                                            |
| Data links                                | If you've configured data links, when the cell type is **Auto**, the cell text becomes clickable. If you change the cell type to **Data links**, the cell text reflects the titles of the configured data links. To control the application of data link text more granularly, use a **Cell option > Cell type > Data links** field override. |
| [JSON View](#json-view)                   | Shows values formatted as code.                                                                                                                                                                                                                                                                                                               |
| [Image](#image)                           | If the field value is an image URL or a base64 encoded image, the table displays the image.                                                                                                                                                                                                                                                   |

##### Sparkline

This cell type shows values rendered as a sparkline.
To show sparklines on data with multiple time series, use the [Time series to table transformation](ref:time-series-to-table-transformation) to process it into a format the table can show.

![Table using sparkline cell type](/media/docs/grafana/panels-visualizations/screenshot-table-as-sparkline-v11.3.png)

You can customize sparklines with many of the same options as the [time series visualization](ref:time-series-panel) including line style and width, fill opacity, gradient mode, and more.
You can also change the color of the sparkline by updating the [color scheme](ref:color-scheme) in the **Standard options** section of the panel configuration.

##### Colored text

If thresholds are set, with this cell type, the field text is displayed in the appropriate threshold color.

![Table with colored text cell type](/media/docs/grafana/panels-visualizations/screenshot-table-colored-text-v11.3-2.png)

{{< admonition type="note" >}}
This is an experimental feature.
{{< /admonition >}}

##### Colored background

If thresholds are set, with this cell type, the field background is displayed in the appropriate threshold color.

![Table with colored background cell type](/media/docs/grafana/panels-visualizations/screenshot-table-colored-bkgrnd-v11.3-2.png)

- **Background display mode** - Choose between **Basic** and **Gradient**.
- **Apply to entire row** - Toggle the switch on to apply the background color that's configured for the cell to the whole row.

![Table with background cell color applied to row](/media/docs/grafana/panels-visualizations/screenshot-table-colored-row-v11.3.png)

##### Gauge

With this cell type, cells can be displayed as a graphical gauge, with several different presentation types controlled by the [gauge display mode](#gauge-display-mode) and the [value display](#value-display).

{{< admonition type="note" >}}
The maximum and minimum values of the gauges are configured automatically from the smallest and largest values in your whole dataset.
If you don't want the max/min values to be pulled from the whole dataset, you can configure them for each column using [field overrides](#field-overrides).
{{< /admonition >}}

###### Gauge display mode

You can set three gauge display modes.

<!-- prettier-ignore-start -->

| Option | Description |
| ------ | ----------- |
| Basic | Shows a simple gauge with the threshold levels defining the color of gauge. {{< figure src="/media/docs/grafana/panels-visualizations/screenshot-gauge-mode-basic-v11.3.png" alt="Table cell with basic gauge mode" >}} |
| Gradient | The threshold levels define a gradient. {{< figure src="/media/docs/grafana/panels-visualizations/screenshot-gauge-mode-gradient-v11.3.png" alt="Table cell with gradient gauge mode" >}} |
| Retro LCD | The gauge is split up in small cells that are lit or unlit. {{< figure src="/media/docs/grafana/panels-visualizations/screenshot-gauge-mode-retro-v11.3.png" alt="Table cell with retro LCD gauge mode" >}} |

<!-- prettier-ignore-end -->

###### Value display

Labels displayed alongside of the gauges can be set to be colored by value, match the theme text color, or be hidden.

<!-- prettier-ignore-start -->

| Option | Description |
| ------ | ----------- |
| Value color | Labels are colored by value. {{< figure src="/media/docs/grafana/panels-visualizations/screenshot-labels-value-color-v11.3.png" alt="Table with labels in value color" >}} |
| Text color | Labels match the theme text color. {{< figure src="/media/docs/grafana/panels-visualizations/screenshot-labels-text-color-v11.3.png" alt="Table with labels in theme color" >}} |
| Hidden | Labels are hidden. {{< figure src="/media/docs/grafana/panels-visualizations/screenshot-labels-hidden-v11.3.png" alt="Table with labels hidden" >}} |

<!-- prettier-ignore-end -->

##### JSON View

This cell type shows values formatted as code.
If a value is an object the JSON view allowing browsing the JSON object will appear on hover.

{{< figure src="/static/img/docs/tables/json-view.png" max-width="350px" alt="JSON view" class="docs-image--no-shadow" >}}

##### Image

If you have a field value that is an image URL or a base64 encoded image, this cell type displays it as an image.

![Table with image cell type](/media/docs/grafana/panels-visualizations/screenshot-table-cell-image-v11.3.png)

Set the following options:

- **Alt text** - Set the alternative text of an image. The text will be available for screen readers and in cases when images can't be loaded.
- **Title text** - Set the text that's displayed when the image is hovered over with a cursor.

#### Wrap text

{{< admonition type="note" >}}
Text wrapping is in [public preview](https://grafana.com/docs/release-life-cycle/#public-preview), however, it’s available to use by default.
We’d love hear from you about how this new feature is working. To provide feedback, you can open an issue in the [Grafana GitHub repository](https://github.com/grafana/grafana).
{{< /admonition >}}

Toggle the **Wrap text** switch to wrap text in the cell that contains the longest content in your table.

To wrap the text _in a specific column only_, use a **Fields with name** [field override](ref:field-override), select the **Cell options > Cell type** override property, and toggle on the **Wrap text** switch.

This option is available for the following cell types: **Auto**, **Colored text**, and **Colored background**.

#### Cell value inspect

Enables value inspection from table cells. When the **Cell inspect value** switch is toggled on, clicking the inspect icon in a cell opens the **Inspect value** drawer.

The **Inspect value** drawer has two tabs, **Plain text** and **Code editor**.
Grafana attempts to automatically detect the type of data in the cell and opens the drawer with the associated tab showing.
However, you can switch back and forth between tabs.

This option is available for the following cell types: **Auto**, **Colored text**, **Colored background**, and **JSON View**.

If you want to apply this setting to only some fields instead of all fields, you can do so using the **Cell options > Cell value inspect** field override.

### Standard options

{{< docs/shared lookup="visualizations/standard-options.md" source="grafana" version="<GRAFANA_VERSION>" >}}

### Data links

{{< docs/shared lookup="visualizations/datalink-options.md" source="grafana" version="<GRAFANA_VERSION>" >}}

### Value mappings

{{< docs/shared lookup="visualizations/value-mappings-options.md" source="grafana" version="<GRAFANA_VERSION>" >}}

### Thresholds

{{< docs/shared lookup="visualizations/thresholds-options-2.md" source="grafana" version="<GRAFANA_VERSION>" >}}

### Field overrides

{{< docs/shared lookup="visualizations/overrides-options.md" source="grafana" version="<GRAFANA_VERSION>" >}}
