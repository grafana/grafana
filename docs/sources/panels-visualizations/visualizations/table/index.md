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
---

# Table

Tables are a highly flexible visualization designed to display data in columns and rows. They support various data types, including tables, time series, annotations, and raw JSON data. The table visualization can even take multiple data sets and provide the option to switch between them. With this versatility, it's the preferred visualization for viewing multiple data types, aiding in your data analysis needs.

{{< figure src="/static/img/docs/tables/table_visualization.png" max-width="1200px" lightbox="true" caption="Table visualization" >}}

The following video provides a visual walkthrough of the options you can set in a table visualization. If you want to see a configuration in action, check out the video:

{{< youtube id="PCY7O8EJeJY" >}}

{{< docs/play title="Table Visualizations in Grafana" url="https://play.grafana.org/d/OhR1ID6Mk/" >}}

{{< admonition type="note" >}}
Annotations and alerts are not currently supported for tables.
{{< /admonition >}}

## Sort column

Click a column title to change the sort order from default to descending to ascending. Each time you click, the sort order changes to the next option in the cycle. You can sort multiple columns by holding the `shift` key and clicking the column name.

![Sort descending](/static/img/docs/tables/sort-descending.png 'Sort descending')

## Data set selector

If the data queried contains multiple data sets, a table displays a drop-down list at the bottom, so you can select the data set you want to visualize.

![Table visualization with multiple data sets](/media/docs/grafana/panels-visualizations/TablePanelMultiSet.png)

## Panel options

{{< docs/shared lookup="visualizations/panel-options.md" source="grafana" version="<GRAFANA_VERSION>" >}}

## Table options

{{% admonition type="note" %}}
If you are using a table created before Grafana 7.0, then you need to migrate to the new table version in order to see these options. To migrate, on the Panel tab, click **Table** visualization. Grafana updates the table version and you can then access all table options.
{{% /admonition %}}

### Show header

Show or hide column names imported from your data source.

### Column width

By default, Grafana automatically calculates the column width based on the table size and the minimum column width. This field option can override the setting and define the width for all columns in pixels.

For example, if you enter `100` in the field, then when you click outside the field, all the columns will be set to 100 pixels wide.

### Minimum column width

By default, the minimum width of the table column is 150 pixels. This field option can override that default and will define the new minimum column width for the table in pixels.

For example, if you enter `75` in the field, then when you click outside the field, all the columns will scale to no smaller than 75 pixels wide.

For small-screen devices, such as smartphones or tablets, reduce the default `150` pixel value to`50` to allow table-based panels to render correctly in dashboards.

### Column alignment

Choose how Grafana should align cell contents:

- Auto (default)
- Left
- Center
- Right

### Column filter

You can temporarily change how column data is displayed. For example, you can order values from highest to lowest or hide specific values. For more information, refer to [Filter table columns](#filter-table-columns).

### Pagination

Use this option to enable or disable pagination. It is a front-end option that does not affect queries. When enabled, the page size automatically adjusts to the height of the table.

## Cell options

### Cell type

By default, Grafana automatically chooses display settings. You can override the settings by choosing one of the following options to set the default for all fields. Additional configuration is available for some cell types.

{{% admonition type="note" %}}
If you set these in the Field tab, then the type will apply to all fields, including the time field. Many options will work best if you set them in the Override tab so that they can be restricted to one or more fields.
{{% /admonition %}}

#### Auto

The **Auto** cell type automatically displays values, with sensible defaults applied.

#### Color text

If thresholds are set, then the field text is displayed in the appropriate threshold color.

{{< figure src="/static/img/docs/tables/color-text.png" max-width="500px" caption="Color text" class="docs-image--no-shadow" >}}

#### Color background (gradient or solid)

If thresholds are set, then the field background is displayed in the appropriate threshold color.

{{< figure src="/static/img/docs/tables/color-background.png" max-width="500px" caption="Color background" class="docs-image--no-shadow" >}}

Toggle the **Apply to entire row** switch, to apply the background color that's configured for the cell to the whole row.

{{< figure src="/static/img/docs/tables/colored-rows.png" max-width="500px" alt="Colored row background" class="docs-image--no-shadow" >}}

#### Gauge

Cells can be displayed as a graphical gauge, with several different presentation types.

{{< admonition type="note" >}}
The maximum and minimum values of the gauges are configured automatically from the smallest and largest values in your whole data set. If you don't want the max/min values to be pulled from the whole data set, you can configure them for each column with field overrides.
{{< /admonition >}}

##### Basic

The basic mode will show a simple gauge with the threshold levels defining the color of gauge.

{{< figure src="/static/img/docs/tables/basic-gauge.png" max-width="500px" caption="Gradient gauge" class="docs-image--no-shadow" >}}

##### Gradient

The threshold levels define a gradient.

{{< figure src="/static/img/docs/tables/gradient-gauge.png" max-width="500px" caption="Gradient gauge" class="docs-image--no-shadow" >}}

##### LCD

The gauge is split up in small cells that are lit or unlit.

{{< figure src="/static/img/docs/tables/lcd-gauge.png" max-width="500px" caption="LCD gauge" class="docs-image--no-shadow" >}}

##### Label Options

Additionally, labels displayed alongside of the gauges can be set to be colored by value, match the theme text color, or be hidden.

**Value Color**

{{< figure src="/static/img/docs/tables/value-color-mode.png" max-width="500px" caption="Color Label by Value" class="docs-image--no-shadow" >}}

**Text Color**

{{< figure src="/static/img/docs/tables/text-color-mode.png" max-width="500px" caption="Color Label by theme color" class="docs-image--no-shadow" >}}

**Hidden**

{{< figure src="/static/img/docs/tables/hidden-mode.png" max-width="500px" caption="Hide Label" class="docs-image--no-shadow" >}}

#### Data links

If you've configured data links, when the cell type is **Auto** mode, the cell text becomes clickable. If you change the cell type to **Data links**, the cell text reflects the titles of the configured data links. To control the application of data link text more granularly use a **Cell option > Cell type > Data links** field override.

#### JSON view

Shows value formatted as code. If a value is an object the JSON view allowing browsing the JSON object will appear on hover.

{{< figure src="/static/img/docs/tables/json-view.png" max-width="500px" caption="JSON view" class="docs-image--no-shadow" >}}

#### Image

> Only available in Grafana 7.3+

If you have a field value that is an image URL or a base64 encoded image you can configure the table to display it as an image.

{{< figure src="/static/img/docs/v73/table_hover.gif" max-width="900px" caption="Table hover" >}}

Use the **Alt text** option to set the alternative text of an image. The text will be available for screen readers and in cases when images can't be loaded.

Use the **Title text** option to set the text that's displayed when the image is hovered over with a cursor.

#### Sparkline

Shows values rendered as a sparkline. You can show sparklines using the [Time series to table transformation](ref:time-series-to-table-transformation) on data with multiple time series to process it into a format the table can show.

{{< figure src="/static/img/docs/tables/sparkline2.png" max-width="500px" caption="Sparkline" class="docs-image--no-shadow" >}}

You can be customize sparklines with many of the same options as the [Time series panel](ref:time-series-panel) including line width, fill opacity, and more. You can also change the color of the sparkline by updating the [color scheme](ref:color-scheme) in the _Standard options_ section of the panel configuration.

### Wrap text

{{< admonition type="note" >}}
Text wrapping is in [public preview](https://grafana.com/docs/release-life-cycle/#public-preview), however, it’s available to use by default. We’d love hear from you about how this new feature is working. To provide feedback, you can open an issue in the [Grafana GitHub repository](https://github.com/grafana/grafana).
{{< /admonition >}}

Toggle the **Wrap text** switch to wrap text in the cell with the longest content in your table. To wrap the text in a specific column only, use the Wrap Text option in a [field override](ref:field-override).

### Cell value inspect

Enables value inspection from table cell. The raw value is presented in a modal window.

{{% admonition type="note" %}}
Cell value inspection is only available when cell display mode is set to Auto, Color text, Color background or JSON View.
{{% /admonition %}}

## Turn on column filtering

1. In Grafana, navigate to the dashboard with the table with the columns that you want to filter.
1. On the table panel you want to filter, open the panel editor.
1. Click the **Field** tab.
1. In Table options, turn on the **Column filter** option.

A filter icon appears next to each column title.

{{< figure src="/static/img/docs/tables/column-filter-with-icon.png" max-width="500px" caption="Column filtering turned on" class="docs-image--no-shadow" >}}

### Filter column values

To filter column values, click the filter (funnel) icon next to a column title. Grafana displays the filter options for that column.

{{< figure src="/static/img/docs/tables/filter-column-values.png" max-width="500px" caption="Filter column values" class="docs-image--no-shadow" >}}

Click the check box next to the values that you want to display. Enter text in the search field at the top to show those values in the display so that you can select them rather than scroll to find them.

Choose from several operators to display column values:

- **Contains** - Matches a regex pattern (operator by default).
- **Expression** - Evaluates a boolean expression. The character `$` represents the column value in the expression (for example, "$ >= 10 && $ <= 12").
- The typical comparison operators: `=`, `!=`, `<`, `<=`, `>`, `>=`.

Click the check box above the **Ok** and **Cancel** buttons to add or remove all displayed values to/from the filter.

### Clear column filters

Columns with filters applied have a blue funnel displayed next to the title.

{{< figure src="/static/img/docs/tables/filtered-column.png" max-width="500px" caption="Filtered column" class="docs-image--no-shadow" >}}

To remove the filter, click the blue funnel icon and then click **Clear filter**.

## Table footer

You can use the table footer to show [calculations](ref:calculations) on fields.

After you enable the table footer:

1. Select the **Calculation**
2. Select the **Fields** that you want to calculate

The system applies the calculation to all numeric fields if you do not select a field.

### Count rows

If you want to show the number of rows in the dataset instead of the number of values in the selected fields, select the **Count** calculation and enable **Count rows**.

## Standard options

{{< docs/shared lookup="visualizations/standard-options.md" source="grafana" version="<GRAFANA_VERSION>" >}}

## Data links

{{< docs/shared lookup="visualizations/datalink-options.md" source="grafana" version="<GRAFANA_VERSION>" >}}

## Value mappings

{{< docs/shared lookup="visualizations/value-mappings-options.md" source="grafana" version="<GRAFANA_VERSION>" >}}

## Thresholds

{{< docs/shared lookup="visualizations/thresholds-options-2.md" source="grafana" version="<GRAFANA_VERSION>" >}}

## Field overrides

{{< docs/shared lookup="visualizations/overrides-options.md" source="grafana" version="<GRAFANA_VERSION>" >}}
