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
  formatTime: {
    name: 'Format time',
    content: `
    Use this transformation to format the output of a time field. Output can be formatted using (Moment.js format strings)[https://momentjs.com/docs/#/displaying/]. For instance, if you would like to display only the year of a time field the format string 'YYYY' can be used to show the calendar year (e.g. 1999, 2012, etc.).
    
    > **Note:** This transformation is available in Grafana 10.1+ as an alpha feature.
    `,
  },
  groupBy: {
    name: 'Group by',
    content: `
    Use this transformation to group the data by a specified field (column) value and process calculations on each group. Click to see a list of calculation choices. For information about available calculations, refer to [Calculation types](https://grafana.com/docs/grafana/latest/panels-visualizations/calculation-types/).

    Here's an example of original data.

    | Time                | Server ID | CPU Temperature | Server Status |
    | ------------------- | --------- | --------------- | ------------- |
    | 2020-07-07 11:34:20 | server 1  | 80              | Shutdown      |
    | 2020-07-07 11:34:20 | server 3  | 62              | OK            |
    | 2020-07-07 10:32:20 | server 2  | 90              | Overload      |
    | 2020-07-07 10:31:22 | server 3  | 55              | OK            |
    | 2020-07-07 09:30:57 | server 3  | 62              | Rebooting     |
    | 2020-07-07 09:30:05 | server 2  | 88              | OK            |
    | 2020-07-07 09:28:06 | server 1  | 80              | OK            |
    | 2020-07-07 09:25:05 | server 2  | 88              | OK            |
    | 2020-07-07 09:23:07 | server 1  | 86              | OK            |

    This transformation goes in two steps. First you specify one or multiple fields to group the data by. This will group all the same values of those fields together, as if you sorted them. For instance if we group by the Server ID field, then it would group the data this way:

    | Time                | Server ID      | CPU Temperature | Server Status |
    | ------------------- | -------------- | --------------- | ------------- |
    | 2020-07-07 11:34:20 | **server 1**   | 80              | Shutdown      |
    | 2020-07-07 09:28:06 | **server 1**   | 80              | OK            |
    | 2020-07-07 09:23:07 | **server 1**   | 86              | OK            |
    | 2020-07-07 10:32:20 | server 2       | 90              | Overload      |
    | 2020-07-07 09:30:05 | server 2       | 88              | OK            |
    | 2020-07-07 09:25:05 | server 2       | 88              | OK            |
    | 2020-07-07 11:34:20 | **_server 3_** | 62              | OK            |
    | 2020-07-07 10:31:22 | **_server 3_** | 55              | OK            |
    | 2020-07-07 09:30:57 | **_server 3_** | 62              | Rebooting     |

    All rows with the same value of Server ID are grouped together.

    After choosing which field you want to group your data by, you can add various calculations on the other fields, and apply the calculation to each group of rows. For instance, we could want to calculate the average CPU temperature for each of those servers. So we can add the _mean_ calculation applied on the CPU Temperature field to get the following:

    | Server ID | CPU Temperature (mean) |
    | --------- | ---------------------- |
    | server 1  | 82                     |
    | server 2  | 88.6                   |
    | server 3  | 59.6                   |

    And we can add more than one calculation. For instance:

    - For field Time, we can calculate the _Last_ value, to know when the last data point was received for each server
    - For field Server Status, we can calculate the _Last_ value to know what is the last state value for each server
    - For field Temperature, we can also calculate the _Last_ value to know what is the latest monitored temperature for each server

    We would then get :

    | Server ID | CPU Temperature (mean) | CPU Temperature (last) | Time (last)         | Server Status (last) |
    | --------- | ---------------------- | ---------------------- | ------------------- | -------------------- |
    | server 1  | 82                     | 80                     | 2020-07-07 11:34:20 | Shutdown             |
    | server 2  | 88.6                   | 90                     | 2020-07-07 10:32:20 | Overload             |
    | server 3  | 59.6                   | 62                     | 2020-07-07 11:34:20 | OK                   |

    This transformation enables you to extract key information from your time series and display it in a convenient way.
  `,
  },
  groupingToMatrix: {
    name: 'Grouping to Matrix',
    content: `
    Use this transformation to combine three fields-that will be used as input for the **Column**, **Row**, and **Cell value** fields-from the query output, and generate a matrix. This matrix will be calculated as follows:

    **Original data**

    | Server ID | CPU Temperature | Server Status |
    | --------- | --------------- | ------------- |
    | server 1  | 82              | OK            |
    | server 2  | 88.6            | OK            |
    | server 3  | 59.6            | Shutdown      |

    We can generate a matrix using the values of 'Server Status' as column names, the 'Server ID' values as row names, and the 'CPU Temperature' as content of each cell. The content of each cell will appear for the existing column ('Server Status') and row combination ('Server ID'). For the rest of the cells, you can select which value to display between: **Null**, **True**, **False**, or **Empty**.

    **Output**

    | Server ID\Server Status | OK   | Shutdown |
    | ----------------------- | ---- | -------- |
    | server 1                | 82   |          |
    | server 2                | 88.6 |          |
    | server 3                |      | 59.6     |
    `,
  },
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
  histogram: {
    name: 'Histogram',
    content: `
    Use this transformation to generate a histogram based on the input data.

    - **Bucket size** - The distance between the lowest item in the bucket (xMin) and the highest item in the bucket (xMax).
    - **Bucket offset** - The offset for non-zero based buckets.
    - **Combine series** - Create a histogram using all the available series.

    **Original data**

    Series 1:

    | A   | B   | C   |
    | --- | --- | --- |
    | 1   | 3   | 5   |
    | 2   | 4   | 6   |
    | 3   | 5   | 7   |
    | 4   | 6   | 8   |
    | 5   | 7   | 9   |

    Series 2:

    | C   |
    | --- |
    | 5   |
    | 6   |
    | 7   |
    | 8   |
    | 9   |

    **Output**

    | xMin | xMax | A   | B   | C   | C   |
    | ---- | ---- | --- | --- | --- | --- |
    | 1    | 2    | 1   | 0   | 0   | 0   |
    | 2    | 3    | 1   | 0   | 0   | 0   |
    | 3    | 4    | 1   | 1   | 0   | 0   |
    | 4    | 5    | 1   | 1   | 0   | 0   |
    | 5    | 6    | 1   | 1   | 1   | 1   |
    | 6    | 7    | 0   | 1   | 1   | 1   |
    | 7    | 8    | 0   | 1   | 1   | 1   |
    | 8    | 9    | 0   | 0   | 1   | 1   |
    | 9    | 10   | 0   | 0   | 1   | 1   |
    `,
  },
  joinByField: {
    name: 'Join by Field',
    content: `
    Use this transformation to join multiple results into a single table. This is especially useful for converting multiple
    time series results into a single wide table with a shared time field.

    #### Inner join

    An inner join merges data from multiple tables where all tables share the same value from the selected field. This type of join excludes
    data where values do not match in every result.

    Use this transformation to combine the results from multiple queries (combining on a passed join field or the first time column) into one result, and drop rows where a successful join cannot occur.

    In the following example, two queries return table data. It is visualized as two separate tables before applying the inner join transformation.

    Query A:

    | Time                | Job     | Uptime    |
    | ------------------- | ------- | --------- |
    | 2020-07-07 11:34:20 | node    | 25260122  |
    | 2020-07-07 11:24:20 | postgre | 123001233 |
    | 2020-07-07 11:14:20 | postgre | 345001233 |

    Query B:

    | Time                | Server   | Errors |
    | ------------------- | -------- | ------ |
    | 2020-07-07 11:34:20 | server 1 | 15     |
    | 2020-07-07 11:24:20 | server 2 | 5      |
    | 2020-07-07 11:04:20 | server 3 | 10     |

    The result after applying the inner join transformation looks like the following:

    | Time                | Job     | Uptime    | Server   | Errors |
    | ------------------- | ------- | --------- | -------- | ------ |
    | 2020-07-07 11:34:20 | node    | 25260122  | server 1 | 15     |
    | 2020-07-07 11:24:20 | postgre | 123001233 | server 2 | 5      |

    #### Outer join

    An outer join includes all data from an inner join and rows where values do not match in every input. While the inner join joins Query A and Query B on the time field, the outer join includes all rows that don't match on the time field.

    In the following example, two queries return table data. It is visualized as two tables before applying the outer join transformation.

    Query A:

    | Time                | Job     | Uptime    |
    | ------------------- | ------- | --------- |
    | 2020-07-07 11:34:20 | node    | 25260122  |
    | 2020-07-07 11:24:20 | postgre | 123001233 |
    | 2020-07-07 11:14:20 | postgre | 345001233 |

    Query B:

    | Time                | Server   | Errors |
    | ------------------- | -------- | ------ |
    | 2020-07-07 11:34:20 | server 1 | 15     |
    | 2020-07-07 11:24:20 | server 2 | 5      |
    | 2020-07-07 11:04:20 | server 3 | 10     |

    The result after applying the outer join transformation looks like the following:

    | Time                | Job     | Uptime    | Server   | Errors |
    | ------------------- | ------- | --------- | -------- | ------ |
    | 2020-07-07 11:04:20 |         |           | server 3 | 10     |
    | 2020-07-07 11:14:20 | postgre | 345001233 |          |        |
    | 2020-07-07 11:34:20 | node    | 25260122  | server 1 | 15     |
    | 2020-07-07 11:24:20 | postgre | 123001233 | server 2 | 5      |
    `,
  },
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
