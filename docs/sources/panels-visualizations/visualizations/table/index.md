---
aliases:
  - ../../features/panels/table_panel/
  - ../../panels/visualizations/table/filter-table-columns/
  - ../../reference/table/
  - ../../visualizations/table/
  - ../../visualizations/table/filter-table-columns/
  - /docs/grafana/next/panels/visualizations/table/table-field-options/
description: Learn about table panel visualization features.
keywords:
  - grafana
  - dashboard
  - panels
  - table panel
  - table options
  - format tables
  - table filter
  - filter columns
menuTitle: Table
title: Table
weight: 1000
---

# Table

The table panel visualization is very flexible, supporting multiple modes for time series and for tables, annotation, and raw JSON data. This panel also provides date formatting, value formatting, and coloring options.

{{< figure src="/static/img/docs/tables/table_visualization.png" max-width="1200px" lightbox="true" caption="Table visualization" >}}

## Annotation and alert support

Annotations and alerts are not currently supported in the new table panel.

## Sort column

Click a column title to change the sort order from default to descending to ascending. Each time you click, the sort order changes to the next option in the cycle. You can sort multiple columns by holding the `shift` key and clicking the column name.

![Sort descending](/static/img/docs/tables/sort-descending.png 'Sort descending')

## Table options

{{% admonition type="note" %}}
If you are using a table visualization created before Grafana 7.0, then you need to migrate to the new table version in order to see these options. To migrate, on the Panel tab, click **Table** visualization. Grafana updates the table version and you can then access all table options.
{{% /admonition %}}

### Show header

Show or hide column names imported from your data source.

## Column width

By default, Grafana automatically calculates the column width based on the table size and the minimum column width. This field option can override the setting and define the width for all columns in pixels.

For example, if you enter `100` in the field, then when you click outside the field, all the columns will be set to 100 pixels wide.

## Minimum column width

By default, the minimum width of the table column is 150 pixels. This field option can override that default and will define the new minimum column width for the table panel in pixels.

For example, if you enter `75` in the field, then when you click outside the field, all the columns will scale to no smaller than 75 pixels wide.

For small-screen devices, such as smartphones or tablets, reduce the default `150` pixel value to`50` to allow table based panels to render correctly in dashboards.

## Column alignment

Choose how Grafana should align cell contents:

- Auto (default)
- Left
- Center
- Right

## Cell type

By default, Grafana automatically chooses display settings. You can override the settings by choosing one of the following options to set the default for all fields. Additional configuration is available for some cell types.

{{% admonition type="note" %}}
If you set these in the Field tab, then the type will apply to all fields, including the time field. Many options will work best if you set them in the Override tab so that they can be restricted to one or more fields.
{{% /admonition %}}

### Color text

If thresholds are set, then the field text is displayed in the appropriate threshold color.

{{< figure src="/static/img/docs/tables/color-text.png" max-width="500px" caption="Color text" class="docs-image--no-shadow" >}}

### Color background (gradient or solid)

If thresholds are set, then the field background is displayed in the appropriate threshold color.

{{< figure src="/static/img/docs/tables/color-background.png" max-width="500px" caption="Color background" class="docs-image--no-shadow" >}}

### Gauge

Cells can be displayed as a graphical gauge, with several different presentation types.

#### Basic

The basic mode will show a simple gauge with the threshold levels defining the color of gauge.

{{< figure src="/static/img/docs/tables/basic-gauge.png" max-width="500px" caption="Gradient gauge" class="docs-image--no-shadow" >}}

#### Gradient

The threshold levels define a gradient.

{{< figure src="/static/img/docs/tables/gradient-gauge.png" max-width="500px" caption="Gradient gauge" class="docs-image--no-shadow" >}}

#### LCD

The gauge is split up in small cells that are lit or unlit.

{{< figure src="/static/img/docs/tables/lcd-gauge.png" max-width="500px" caption="LCD gauge" class="docs-image--no-shadow" >}}

#### Label Options

Additionally, labels displayed alongside of the gauges can be set to be colored by value, match the theme text color, or be hidden.

**Value Color**

{{< figure src="/static/img/docs/tables/value-color-mode.png" max-width="500px" caption="Color Label by Value" class="docs-image--no-shadow" >}}

**Text Color**

{{< figure src="/static/img/docs/tables/text-color-mode.png" max-width="500px" caption="Color Label by theme color" class="docs-image--no-shadow" >}}

**Hidden**

{{< figure src="/static/img/docs/tables/hidden-mode.png" max-width="500px" caption="Hide Label" class="docs-image--no-shadow" >}}

### JSON view

Shows value formatted as code. If a value is an object the JSON view allowing browsing the JSON object will appear on hover.

{{< figure src="/static/img/docs/tables/json-view.png" max-width="500px" caption="JSON view" class="docs-image--no-shadow" >}}

### Image

> Only available in Grafana 7.3+

If you have a field value that is an image URL or a base64 encoded image you can configure the table to display it as an image.

{{< figure src="/static/img/docs/v73/table_hover.gif" max-width="900px" caption="Table hover" >}}

### Sparkline

{{% admonition type="note" %}}
This cell type is available in Grafana 9.5+ as an opt-in beta feature. Modify Grafana [configuration file]({{< relref "../../../setup-grafana/configure-grafana/#configuration-file-location" >}}) to enable the `timeSeriesTable` [feature toggle]({{< relref "../../../setup-grafana/configure-grafana/#feature_toggles" >}}) to use it.
{{% /admonition %}}

Shows value rendered as a sparkline. Requires [time series to table]({{< relref "../../query-transform-data/transform-data/#time-series-to-table-transform" >}}) data transform.

{{< figure src="/static/img/docs/tables/sparkline.png" max-width="500px" caption="Sparkline" class="docs-image--no-shadow" >}}

## Cell value inspect

Enables value inspection from table cell. The raw value is presented in a modal window.

{{% admonition type="note" %}}
Cell value inspection is only available when cell display mode is set to Auto, Color text, Color background or JSON View.
{{% /admonition %}}

## Column filter

You can temporarily change how column data is displayed. For example, you can order values from highest to lowest or hide specific values. For more information, refer to [Filter table columns]({{< relref "#filter-table-columns" >}}).

## Pagination

Use this option to enable or disable pagination. It is a front-end option that does not affect queries. When enabled, the page size automatically adjusts to the height of the table.

## Filter table columns

If you turn on the **Column filter**, then you can filter table options.

### Turn on column filtering

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

### Clear column filters

Columns with filters applied have a blue funnel displayed next to the title.

{{< figure src="/static/img/docs/tables/filtered-column.png" max-width="500px" caption="Filtered column" class="docs-image--no-shadow" >}}

To remove the filter, click the blue funnel icon and then click **Clear filter**.

## Table footer

You can use the table footer to show [calculations]({{< relref "../../calculation-types/" >}}) on fields.

After you enable the table footer:

1. Select the **Calculation**
2. Select the **Fields** that you want to calculate

The system applies the calculation to all numeric fields if you do not select a field.

### Count rows

If you want to show the number of rows in the dataset instead of the number of values in the selected fields, select the **Count** calculation and enable **Count rows**.
