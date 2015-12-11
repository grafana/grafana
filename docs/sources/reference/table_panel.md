----
page_title: Table Panel
page_description: Table Panel Reference
page_keywords: grafana, table, panel, documentation
---

# Table Panel

![](/img/v2/table-panel.png)

The new table panel is very flexible, supporting both multiple modes for time series as well as for
table, annotation and raw JSON data. It also provides date formating and value formating and coloring options.

To view table panels in action and test different configurations with sample data, check out the [Table Panel Showcase in the Grafana Playground](http://play.grafana.org/dashboard/db/table-panel-showcase). 

## Configuration

The table pabel has many ways to manipulate your data for optimal presentation.  

![](/img/v2/table-config.png)

1. `Data`: The To Table Transform field . View Data Options for additional information. 
2. `Table Display`:   
3. `Column Styles`: The Column Styles rules provides the ability to control and override values based on defined rules. The column styles supports regex for value matching, and many 




### Data Display

The Data Display is the primary control for the table panel, allowing you to select the structure of the data within your table

![](/img/v2/table-data-options.png)

1. `To Table Transform`: The options to transform the table 
2. `Columns`: The columns field **needs help from Torkel**


#### To Table Transform

##### Time series to rows

![](/img/v2/table_ts_to_rows.png)

In the most simple mode you can turn time series to rows. This means you get a `Time`, `Metric` and a `Value` column. Where `Metric` is the name of the time series.


#### Time series to columns
![](/img/v2/table_ts_to_columns.png)

This transform allows you to take multiple time series and group them by time. Which will result in the primary column being `Time` and a column for each time series.

#### Time series aggregations
![](/img/v2/table_ts_to_aggregations.png)
This table transformation will lay out your table into rows by metric, allowing columns of `Avg`, `Min`, `Max`, `Total`, `Current` and `Count`. More than one column can be added. 

#### Annotations
![](/img/v2/table_annotations.png)

** I need some help explaining this. **


#### JSON Data
![](/img/v2/table_json_data.png)

** I need some help explaining this. **

### Table Display

![](/img/v2/table-display.png)

1. `Pagination (Page Size)`: The table display fields allow you to control The `Pagination` (page size) is the threshold at which the table rows will be broken into pages. For example, if your table had 95 records with a pagination value of 10, your table would be split across 9 pages.
2. `Scroll`: The `scroll bar` checkbox toggles the ability to scroll within the panel, when unchecked, the panel height will grow to display all rows. 
3. `Font Size`: The `font size` field allows you to increase or decrease the size for the panel, relative to the default font size.


### Column Styles

The column styles allow you control how dates and numbers are formatted.

![](/img/v2/Column-Options.png)

1. `Name or regex`: The Name or Regex field allows for simple or complex matching of metrics formatted within the table. Standard regex formatting is accepted. 
2. `Type`: The three supported types of types are `Number`, `String` and `Date`. 
3. `Supplemental Type Information`: The `Number` and `Date` fields allow for additional configuration of styles. 
   - The `Number` field lets you select how the entire Cell, Value or Row is colored when matching the specified criteria, defined in the Tresholds fields next to it. Additionally, the units and decimals of these matched values can be specified. 
   - The `Date` field, the format of the date may be selected from a preset list of date formats, however free entry is also supported. Standard date formatting of `Y`ear, `M`onth, `D`ay, `H`our, `m`inute and `s`econds are supported.  
4. `Coloring` and `Thresholds`: The color and thresholds for all columns matched in the Name or Regex field can be specified. 
5. `Unit` and `Decimals`: The Unit and Decimal values apply to all numbers appearing within the columns matched in the Name or Regex field.
6.  `Add column style rule`: Multiple column rules are supported on tables.

