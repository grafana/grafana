export const transformationDocsContent = {
  calculateField: {
    name: '',
    content: `
    Use this transformation to add a new field calculated from two other fields. Each transformation allows you to add one new field.
  
    - **Mode -** Select a mode:
      - **Reduce row -** Apply selected calculation on each row of selected fields independently.
      - **Binary option -** Apply basic math operation(sum, multiply, etc) on values in a single row from two selected fields.
      - **Index -** Will insert a field with the row index.
    - **Field name -** Select the names of fields you want to use in the calculation for the new field.
    - **Calculation -** If you select **Reduce row** mode, then the **Calculation** field appears. Click in the field to see a list of calculation choices you can use to create the new field. For information about available calculations, refer to [Calculation types]({{< relref "../../calculation-types" >}}).
    - **Operation -** If you select **Binary option** mode, then the **Operation** fields appear. These fields allow you to do basic math operations on values in a single row from two selected fields. You can also use numerical values for binary operations.
    - **Alias -** (Optional) Enter the name of your new field. If you leave this blank, then the field will be named to match the calculation.
    - **Replace all fields -** (Optional) Select this option if you want to hide all other fields and display only your calculated field in the visualization.
    `,
  },
  concatenate: {
    name: '',
    content: `
    Use this transformation to combine all fields from all frames into one result. Consider the following:

    **Query A:**

    | Temp  | Uptime    |
    | ----- | --------- |
    | 15.4  | 1230233   |

    Query B:

    | AQI   | Errors |
    | ----- | ------ |
    | 3.2   | 5      |

    After you concatenate the fields, the data frame would be:

    | Temp  | Uptime   | AQI   | Errors |
    | ----- | -------- | ----- | ------ |
    | 15.4  | 1230233  | 3.2   | 5      |
    `,
  },
  configFromData: {
    name: '',
    content: `
    Use this transformation to select one query and from it extract standard options such as
    **Min**, **Max**, **Unit**, and **Thresholds** and apply them to other query results.
    This enables dynamic query driven visualization configuration.

    ### Options

    - **Config query**: Selet the query that returns the data you want to use as configuration.
    - **Apply to**: Select what fields or series to apply the configuration to.
    - **Apply to options**: Usually a field type or field name regex depending on what option you selected in **Apply to**.

    ### Field mapping table

    Below the configuration listed above you will find the field table. Here all fields found in the data returned by the config query will be listed along with a **Use as** and **Select** option. This table gives you control over what field should be mapped to which config property and if there are multiple rows which value to select.

    ## Example

    Input[0] (From query: A, name: ServerA)

    | Time          | Value |
    | ------------- | ----- |
    | 1626178119127 | 10    |
    | 1626178119129 | 30    |

    Input[1] (From query: B)

    | Time          | Value |
    | ------------- | ----- |
    | 1626178119127 | 100   |
    | 1626178119129 | 100   |

    Output (Same as Input[0] but now with config on the Value field)

    | Time          | Value (config: Max=100) |
    | ------------- | ----------------------- |
    | 1626178119127 | 10                      |
    | 1626178119129 | 30                      |

    Each row in the source data becomes a separate field. Each field now also has a maximum
    configuration option set. Options such as **min**, **max**, **unit**, and **thresholds** are all part of field configuration, and if they are set like this, they will be used by the visualization instead of any options that are manually configured.
    in the panel editor options pane.

    ## Value mappings

    You can also transform a query result into value mappings. This is is a bit different because every
    row in the configuration query result is used to define a single value mapping row. See the following example.

    Config query result:

    | Value | Text   | Color |
    | ----- | ------ | ----- |
    | L     | Low    | blue  |
    | M     | Medium | green |
    | H     | High   | red   |

    In the field mapping specify:

    | Field | Use as                  | Select     |
    | ----- | ----------------------- | ---------- |
    | Value | Value mappings / Value  | All values |
    | Text  | Value mappings / Text   | All values |
    | Color | Value mappings / Ciolor | All values |

    Grafana will build the value mappings from you query result and apply it the the real data query results. You should see values being mapped and colored according to the config query results.
    `,
  },
  convertFieldType: {
    name: '',
    content: `
    Use this transformation to change the field type of the specified field.

    - **Field -** Select from available fields
    - **as -** Select the FieldType to convert to
      - **Numeric -** attempts to make the values numbers
      - **String -** will make the values strings
      - **Time -** attempts to parse the values as time
        - Will show an option to specify a DateFormat as input by a string like yyyy-mm-dd or DD MM YYYY hh:mm:ss
      - **Boolean -** will make the values booleans

    For example, the following query could be modified by selecting the time field, as Time, and Date Format as YYYY.

    ## Sample Query

    | Time       | Mark      | Value |
    |------------|-----------|-------|
    | 2017-07-01 | above     | 25    |
    | 2018-08-02 | below     | 22    |
    | 2019-09-02 | below     | 29    |
    | 2020-10-04 | above     | 22    |

    The result:

    ## Transformed Query

    | Time                | Mark      | Value |
    |---------------------|-----------|-------|
    | 2017-01-01 00:00:00 | above     | 25    |
    | 2018-01-01 00:00:00 | below     | 22    |
    | 2019-01-01 00:00:00 | below     | 29    |
    | 2020-01-01 00:00:00 | above     | 22    |
    `,
  },
  extractFields: {
    name: '',
    content: `
    Use this transformation to select one source of data and extract content from it in different formats. Set the following fields:

    - **Source** - Select the field for the source of data.
    - **Format** - Select one of the following:
      - **JSON** - To parse JSON content from the source.
      - **Key+value parse** - To parse content in the format 'a=b' or 'c:d' from the source.
      - **Auto** - To discover fields automatically.
    - **Replace all fields** - Optional: Select this option if you want to hide all other fields and display only your calculated field in the visualization.
    - **Keep time** - Optional: Only available if **Replace all fields** is true. Keep the time field in the output.

    Consider the following data set:

    ## Data Set Example

    | Timestamp         | json_data |
    |-------------------|-----------|
    | 1636678740000000000 | {"value": 1} |
    | 1636678680000000000 | {"value": 5} |
    | 1636678620000000000 | {"value": 12} |

    You could prepare the data to be used by a [Time series panel](https://grafana.com/docs/grafana/latest/panels-visualizations/visualizations/time-series/) with this configuration:

    - Source: json_data
    - Format: JSON
      - Field: value
      - Alias: my_value
    - Replace all fields: true
    - Keep time: true

    This will generate the following output:

    ## Transformed Data

    | Timestamp         | my_value |
    |-------------------|----------|
    | 1636678740000000000 | 1        |
    | 1636678680000000000 | 5        |
    | 1636678620000000000 | 12       |
    `,
  },
  fieldLookup: {
    name: '',
    content: `
    Use this transformation on a field value to look up additional fields from an external source.

    - **Field** - Select a text field.
    - **Lookup** - Select from **Countries**, **USA States**, and **Airports**.

    This transformation currently supports spatial data.

    For example, if you have this data:

    ## Data Set Example

    | Location  | Values |
    |-----------|--------|
    | AL        | 0      |
    | AK        | 10     |
    | Arizona   | 5      |
    | Arkansas  | 1      |
    | Somewhere | 5      |

    With this configuration:

    - Field: location
    - Lookup: USA States

    You'll get the following output:

    ## Transformed Data

    | Location  | ID | Name      | Lng        | Lat        | Values |
    |-----------|----|-----------|------------|------------|--------|
    | AL        | AL | Alabama   | -80.891064 | 12.448457  | 0      |
    | AK        | AK | Arkansas  | -100.891064| 24.448457  | 10     |
    | Arizona   |    |           |            |            | 5      |
    | Arkansas  |    |           |            |            | 1      |
    | Somewhere |    |           |            |            | 5      |
    `,
  },
  filterByRefId: {
    name: 'Filter by RefId',
    content: `
    Use this transformation in panels that have multiple queries, if you want to hide one or more of the queries.

    Grafana displays the query identification letters in dark gray text. Click a query identifier to toggle filtering. If the query letter is white, then the results are displayed. If the query letter is dark, then the results are hidden.

    In the example below, the panel has three queries (A, B, C). I removed the B query from the visualization.

    > **Note:** This transformation is not available for Graphite because this data source does not support correlating returned data with queries.
    `,
  },
  filterByValue: {
    name: 'Filter by Value',
    content: `
    Use this transformation to filter your data directly in Grafana and remove some data points from your query result. You have the option to include or exclude data that match one or more conditions you define. The conditions are applied on a selected field.
    
    This transformation is very useful if your data source does not natively filter by values. You might also use this to narrow values to display if you are using a shared query.
    
    The available conditions for all fields are:
    
    - **Regex:** Match a regex expression
    - **Is Null:** Match if the value is null
    - **Is Not Null:** Match if the value is not null
    - **Equal:** Match if the value is equal to the specified value
    - **Different:** Match if the value is different than the specified value
    
    The available conditions for number fields are:
    
    - **Greater:** Match if the value is greater than the specified value
    - **Lower:** Match if the value is lower than the specified value
    - **Greater or equal:** Match if the value is greater or equal
    - **Lower or equal:** Match if the value is lower or equal
    - **Range:** Match a range between a specified minimum and maximum, min and max included
    
    Consider the following data set:
    
    ## Data Set Example
    
    | Time                | Temperature | Altitude |
    |---------------------|-------------|----------|
    | 2020-07-07 11:34:23 | 32          | 101      |
    | 2020-07-07 11:34:22 | 28          | 125      |
    | 2020-07-07 11:34:21 | 26          | 110      |
    | 2020-07-07 11:34:20 | 23          | 98       |
    | 2020-07-07 10:32:24 | 31          | 95       |
    | 2020-07-07 10:31:22 | 20          | 85       |
    | 2020-07-07 09:30:57 | 19          | 101      |
    
    If you **Include** the data points that have a temperature below 30°C, the configuration will look as follows:
    
    - Filter Type: 'Include'
    - Condition: Rows where 'Temperature' matches 'Lower Than' '30'
    
    And you will get the following result, where only the temperatures below 30°C are included:
    
    ## Transformed Data
    
    | Time                | Temperature | Altitude |
    |---------------------|-------------|----------|
    | 2020-07-07 11:34:22 | 28          | 125      |
    | 2020-07-07 11:34:21 | 26          | 110      |
    | 2020-07-07 11:34:20 | 23          | 98       |
    | 2020-07-07 10:31:22 | 20          | 85       |
    | 2020-07-07 09:30:57 | 19          | 101      |
    
    You can add more than one condition to the filter. For example, you might want to include the data only if the altitude is greater than 100. To do so, add that condition to the following configuration:
    
    - Filter type: 'Include' rows that 'Match All' conditions
    - Condition 1: Rows where 'Temperature' matches 'Lower' than '30'
    - Condition 2: Rows where 'Altitude' matches 'Greater' than '100'
    
    When you have more than one condition, you can choose if you want the action (include / exclude) to be applied on rows that **Match all** conditions or **Match any** of the conditions you added.
    
    In the example above, we chose **Match all** because we wanted to include the rows that have a temperature lower than 30°C *AND* an altitude higher than 100. If we wanted to include the rows that have a temperature lower than 30°C *OR* an altitude higher than 100 instead, then we would select **Match any**. This would include the first row in the original data, which has a temperature of 32°C (does not match the first condition) but an altitude of 101 (which matches the second condition), so it is included.
    
    Conditions that are invalid or incompletely configured are ignored.
    `,
  },
  filterFieldsByName: {
    name: 'Filter fields by name',
    content: `
    Use this transformation to remove portions of the query results.

    Grafana displays the **Identifier** field, followed by the fields returned by your query.

    You can apply filters in one of two ways:

    - Enter a regex expression.
    - Click a field to toggle filtering on that field. Filtered fields are displayed with dark gray text, unfiltered fields have white text.
    `,
  },
  // formatTime: formatTimeHelper,
  // groupBy: groupByHelper,
  // groupingToMatrix: groupingToMatrixHelper,
  heatmap: {
    name: '',
    content: `
    Use this transformation to prepare histogram data to be visualized over time. Similar to the Heatmap panel, this transformation allows you to convert histogram metrics to buckets over time.

    #### X Bucket

    This setting determines how the x-axis is split into buckets.

    - **Size** - Specify a time interval in the input field. For example, a time range of '1h' makes the cells one hour wide on the x-axis.
    - **Count** - For non-time related series, use this option to define the number of elements in a bucket.

    #### Y Bucket

    This setting determines how the y-axis is split into buckets.

    - **Linear**
    - **Logarithmic** - Use a base 2 or base 10.
    - **Symlog** - A symmetrical logarithmic scale. Use a base 2 or base 10; allows negative values.
    `,
  },
  // histogram: histogramHelper,
  // joinByField: joinByFieldHelper,
  // joinByLabels: joinByLabelsHelper,
  // labelsToFields: labelsToFieldsHelper,
  // limit: limitHelper,
  // merge: mergeHelper,
  // organize: organizeFieldsHelper,
  // partitionByValues: partitionByValuesHelper,
  // prepareTimeSeries: prepareTimeSeriesHelper,
  // reduce: reduceHelper,
  // renameByRegex: renameByRegexHelper,
  // rowsToFields: rowsToFieldsHelper,
  // seriesToRows: seriesToRowsHelper,
  // sortBy: sortByHelper,
  // spatial: spatialHelper,
  // timeSeriesTable: timeSeriesTableHelper,
};
