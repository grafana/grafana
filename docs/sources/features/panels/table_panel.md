+++
title = "Table Panel"
keywords = ["grafana", "dashboard", "documentation", "panels", "table panel"]
type = "docs"
aliases = ["/reference/table/"]
[menu.docs]
name = "Table"
parent = "panels"
weight = 2
+++


# Table Panel

<img class="screenshot" src="/assets/img/features/table-panel.png">

The new table panel is very flexible, supporting both multiple modes for time series as well as for
table, annotation and raw JSON data. It also provides date formatting and value formatting and coloring options.

To view table panels in action and test different configurations with sample data, check out the [Table Panel Showcase in the Grafana Playground](http://play.grafana.org/dashboard/db/table-panel-showcase).

## Options overview

The table panel has many ways to manipulate your data for optimal presentation.
{{< docs-imagebox img="/img/docs/v45/table_options.png" class="docs-image--no-shadow" max-width= "500px" >}}


1. `Data`: Control how your query is transformed into a table.
2. `Paging`: Table display options.


## Data to Table

{{< docs-imagebox img="/img/docs/v45/table_data_options.png" max-width="500px" class="docs-image--right">}}

The data section contains the **To Table Transform (1)**. This is the primary option for how your data/metric
query should be transformed into a table format.  The **Columns (2)** option allows you to select what columns
you want in the table. Only applicable for some transforms.

<div class="clearfix"></div>

### Time series to rows

{{< docs-imagebox img="/img/docs/v45/table_ts_to_rows.png"  >}}

In the most simple mode you can turn time series to rows. This means you get a `Time`, `Metric` and a `Value` column. Where `Metric` is the name of the time series.

### Time series to columns

{{< docs-imagebox img="/img/docs/v45/table_ts_to_columns.png" >}}


This transform allows you to take multiple time series and group them by time. Which will result in the primary column being `Time` and a column for each time series.

### Time series aggregations

{{< docs-imagebox img="/img/docs/v45/table_ts_to_aggregations.png" >}}

This table transformation will lay out your table into rows by metric, allowing columns of `Avg`, `Min`, `Max`, `Total`, `Current` and `Count`. More than one column can be added.

### Annotations

{{< docs-imagebox img="/img/docs/v45/table_annotations.png" >}}


If you have annotations enabled in the dashboard you can have the table show them. If you configure this
mode then any queries you have in the metrics tab will be ignored.

### JSON Data

{{< docs-imagebox img="/img/docs/v45/table_json_data.png" max-width="500px" >}}

If you have an Elasticsearch **Raw Document** query or an Elasticsearch query without a `date histogram` use this
transform mode and pick the columns using the **Columns** section.


{{< docs-imagebox img="/img/docs/v45/elastic_raw_doc.png" >}}

## Table Display

{{< docs-imagebox img="/img/docs/v45/table_paging.png" class="docs-image--no-shadow docs-image--right" max-width="350px" >}}

1. `Pagination (Page Size)`: The table display fields allow you to control The `Pagination` (page size) is the threshold at which the table rows will be broken into pages. For example, if your table had 95 records with a pagination value of 10, your table would be split across 9 pages.
2. `Scroll`: The `scroll bar` checkbox toggles the ability to scroll within the panel, when unchecked, the panel height will grow to display all rows.
3. `Font Size`: The `font size` field allows you to increase or decrease the size for the panel, relative to the default font size.


## Column Styles

The column styles allow you control how dates and numbers are formatted.

{{< docs-imagebox img="/img/docs/v45/table_column_styles.png" class="docs-image--no-shadow" >}}

1. `Name or regex`: The Name or Regex field controls what columns the rule should be applied to. The regex or name filter will be matched against the column name not against column values.
2. `Column Header`: Title for the column, when using a Regex the title can include replacement strings like `$1`.
3.  `Add column style rule`: Add new column rule.
4. `Thresholds` and `Coloring`: Specify color mode and thresholds limits.
5. `Type`: The three supported types of types are `Number`, `String` and `Date`. `Unit` and `Decimals`: Specify unit and decimal precision for numbers.`Format`: Specify date format for dates.

