/*
  NOTE: This file is used to generate the transformation docs markdown content. If you change/update the content here,
  please then rebuild the markdown by doing the following:

  $ cd /docs (from the root of the repository)
  $ make sources/panels-visualizations/query-transform-data/transform-data/index.md
  $ make docs

  Browse to http://localhost:3003/docs/grafana/latest/panels-visualizations/query-transform-data/transform-data/

  Refer to ./docs/README.md for more information about building docs. 
*/

interface Link {
  title: string;
  url: string;
}
export interface TransformationInfo {
  name: string;
  getHelperDocs: (imageRenderType?: ImageRenderType) => string;
  links?: Link[];
}

export enum ImageRenderType {
  ShortcodeFigure = 'shortcodeFigure',
  UIImage = 'uiImage',
}

export interface TransformationDocsContentType {
  [key: string]: TransformationInfo;
}

export const transformationDocsContent: TransformationDocsContentType = {
  calculateField: {
    name: 'Add field from calculation',
    /*
      `getHelperDocs` will build the markdown content based in the `ImageRenderType`.
      The images will either be rendered in Hugo Shortcode format or as standard markdown for UI usage.
    */
    getHelperDocs: function (imageRenderType: ImageRenderType = ImageRenderType.ShortcodeFigure) {
      return `
Use this transformation to add a new field calculated from two other fields. Each transformation allows you to add one new field.

- **Mode** - Select a mode:
  - **Reduce row** - Apply selected calculation on each row of selected fields independently.
  - **Binary operation** - Apply basic binary operations (for example, sum or multiply) on values in a single row from two selected fields.
  - **Unary operation** - Apply basic unary operations on values in a single row from a selected field. The available operations are:
    - **Absolute value (abs)** - Returns the absolute value of a given expression. It represents its distance from zero as a positive number.
    - **Natural exponential (exp)** - Returns _e_ raised to the power of a given expression.
    - **Natural logarithm (ln)** - Returns the natural logarithm of a given expression.
    - **Floor (floor)** - Returns the largest integer less than or equal to a given expression.
    - **Ceiling (ceil)** - Returns the smallest integer greater than or equal to a given expression.
  - **Cumulative functions** - Apply functions on the current row and all preceding rows.
    - **Total** - Calculates the cumulative total up to and including the current row.
    - **Mean** - Calculates the mean up to and including the current row.
  - **Window functions** - Apply window functions. The window can either be **trailing** or **centered**.
    With a trailing window the current row will be the last row in the window.
    With a centered window the window will be centered on the current row.
    For even window sizes, the window will be centered between the current row, and the previous row.
    - **Mean** - Calculates the moving mean or running average.
    - **Stddev** - Calculates the moving standard deviation.
    - **Variance** - Calculates the moving variance.
  - **Row index** - Insert a field with the row index.
- **Field name** - Select the names of fields you want to use in the calculation for the new field.
- **Calculation** - If you select **Reduce row** mode, then the **Calculation** field appears. Click in the field to see a list of calculation choices you can use to create the new field. For information about available calculations, refer to [Calculation types][].
- **Operation** - If you select **Binary operation** or **Unary operation** mode, then the **Operation** fields appear. These fields allow you to apply basic math operations on values in a single row from selected fields. You can also use numerical values for binary operations.
  - **All number fields** - Set the left side of a **Binary operation** to apply the calculation to all number fields.
- **As percentile** - If you select **Row index** mode, then the **As percentile** switch appears. This switch allows you to transform the row index as a percentage of the total number of rows.
- **Alias** - (Optional) Enter the name of your new field. If you leave this blank, then the field will be named to match the calculation.
> **Note:** If a variable is used in this transformation, the default alias will be interpolated with the value of the variable. If you want an alias to be unaffected by variable changes, explicitly define the alias.
- **Replace all fields** - (Optional) Select this option if you want to hide all other fields and display only your calculated field in the visualization.

In the example below, we added two fields together and named them Sum.

${buildImageContent(
  '/static/img/docs/transformations/add-field-from-calc-stat-example-7-0.png',
  imageRenderType,
  'A stat visualization including one field called Sum'
)}
  `;
    },
    links: [
      {
        title: 'Calculation types',
        url: 'https://grafana.com/docs/grafana/latest/panels-visualizations/calculation-types/',
      },
    ],
  },
  concatenate: {
    name: 'Concatenate fields',
    getHelperDocs: function () {
      return `
Use this transformation to combine all fields from all frames into one result.

For example, if you have separate queries retrieving temperature and uptime data (Query A) and air quality index and error information (Query B), applying the concatenate transformation yields a consolidated data frame with all relevant information in one view.

Consider the following:

**Query A:**

| Temp  | Uptime  |
| ----- | ------- |
| 15.4  | 1230233 |

**Query B:**

| AQI   | Errors |
| ----- | ------ |
| 3.2   | 5      |

After you concatenate the fields, the data frame would be:

| Temp | Uptime  | AQI | Errors |
| ---- | ------- | --- | ------ |
| 15.4 | 1230233 | 3.2 | 5      |

This transformation simplifies the process of merging data from different sources, providing a comprehensive view for analysis and visualization.
  `;
    },
  },
  configFromData: {
    name: 'Config from query results',
    getHelperDocs: function () {
      return `
Use this transformation to select a query and extract standard options, such as **Min**, **Max**, **Unit**, and **Thresholds**, and apply them to other query results. This feature enables dynamic visualization configuration based on the data returned by a specific query.

#### Options

- **Config query** - Select the query that returns the data you want to use as configuration.
- **Apply to** - Select the fields or series to which the configuration should be applied.
- **Apply to options** - Specify a field type or use a field name regex, depending on your selection in **Apply to**.

#### Field mapping table

Below the configuration options, you'll find the field mapping table. This table lists all fields found in the data returned by the config query, along with **Use as** and **Select** options. It provides control over mapping fields to config properties, and for multiple rows, it allows you to choose which value to select.

#### Example

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

Each row in the source data becomes a separate field. Each field now has a maximum configuration option set. Options such as **Min**, **Max**, **Unit**, and **Thresholds** are part of the field configuration. If set, they are used by the visualization instead of any options manually configured in the panel editor options pane.

#### Value mappings

You can also transform a query result into value mappings. With this option, every row in the configuration query result defines a single value mapping row. See the following example.

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
| Color | Value mappings / Color | All values |

Grafana builds value mappings from your query result and applies them to the real data query results. You should see values being mapped and colored according to the config query results.

> **Note:** When you use this transformation for thresholds, the visualization continues to use the panel's base threshold.

  `;
    },
  },
  convertFieldType: {
    name: 'Convert field type',
    getHelperDocs: function () {
      return `
Use this transformation to modify the field type of a specified field.

This transformation has the following options:

- **Field** - Select from available fields
- **as** - Select the FieldType to convert to
  - **Numeric** - attempts to make the values numbers
  - **String** - will make the values strings
  - **Time** - attempts to parse the values as time
    - The input will be parsed according to the [Moment.js parsing format](https://momentjs.com/docs/#/parsing/)
    - It will parse the numeric input as a Unix epoch timestamp in milliseconds.
      You must multiply your input by 1000 if it's in seconds.
    - Will show an option to specify a DateFormat as input by a string like yyyy-mm-dd or DD MM YYYY hh:mm:ss
  - **Boolean** - will make the values booleans
  - **Enum** - will make the values enums
    - Will show a table to manage the enums
  - **Other** - attempts to parse the values as JSON

For example, consider the following query that could be modified by selecting the time field as Time and specifying Date Format as YYYY.

#### Sample Query

| Time       | Mark  | Value |
|------------|-------|-------|
| 2017-07-01 | above | 25    |
| 2018-08-02 | below | 22    |
| 2019-09-02 | below | 29    |
| 2020-10-04 | above | 22    |

The result:

#### Transformed Query

| Time                | Mark  | Value |
|---------------------|-------|-------|
| 2017-01-01 00:00:00 | above | 25    |
| 2018-01-01 00:00:00 | below | 22    |
| 2019-01-01 00:00:00 | below | 29    |
| 2020-01-01 00:00:00 | above | 22    |

This transformation allows you to flexibly adapt your data types, ensuring compatibility and consistency in your visualizations.
  `;
    },
  },
  extractFields: {
    name: 'Extract fields',
    getHelperDocs: function (imageRenderType: ImageRenderType = ImageRenderType.ShortcodeFigure) {
      return `
Use this transformation to select a source of data and extract content from it in different formats. This transformation has the following fields:

- **Source** - Select the field for the source of data.
- **Format** - Choose one of the following:
  - **JSON** - Parse JSON content from the source.
  - **Key+value pairs** - Parse content in the format 'a=b' or 'c:d' from the source.
  - **RegExp** - Parse content using a regular expression with [named capturing group(s)](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Regular_expressions/Named_capturing_group) like \`/(?<NewField>.*)/\`.
  ${buildImageContent(
    '/media/docs/grafana/panels-visualizations/screenshot-regexp-detail-v11.3-2.png',
    imageRenderType,
    'Example of a regular expression'
  )}
  - **Auto** - Discover fields automatically.
- **Replace All Fields** - (Optional) Select this option to hide all other fields and display only your calculated field in the visualization.
- **Keep Time** - (Optional) Available only if **Replace All Fields** is true. Keeps the time field in the output.

Consider the following dataset:

#### Dataset Example

| Timestamp           | json_data     |
|---------------------|---------------|
| 1636678740000000000 | {"value": 1}  |
| 1636678680000000000 | {"value": 5}  |
| 1636678620000000000 | {"value": 12} |

You could prepare the data to be used by a [Time series panel][] with this configuration:

- Source: json_data
- Format: JSON
  - Field: value
  - Alias: my_value
- Replace all fields: true
- Keep time: true

This will generate the following output:

#### Transformed Data

| Timestamp           | my_value |
|---------------------|----------|
| 1636678740000000000 | 1        |
| 1636678680000000000 | 5        |
| 1636678620000000000 | 12       |

This transformation allows you to extract and format data in various ways. You can customize the extraction format based on your specific data needs.
  `;
    },
    links: [
      {
        title: 'Time series panel',
        url: 'https://grafana.com/docs/grafana/latest/panels-visualizations/visualizations/time-series/',
      },
    ],
  },
  fieldLookup: {
    name: 'Lookup fields from resource',
    getHelperDocs: function () {
      return `
Use this transformation to enrich a field value by looking up additional fields from an external source. 
  
This transformation has the following fields:

- **Field** - Select a text field from your dataset.
- **Lookup** - Choose from **Countries**, **USA States**, and **Airports**.

This transformation currently supports spatial data.

For example, if you have this data:

#### Dataset Example

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

#### Transformed Data

| Location  | ID | Name     | Lng         | Lat       | Values |
|-----------|----|----------|-------------|-----------|--------|
| AL        | AL | Alabama  | -80.891064  | 12.448457 | 0      |
| AK        | AK | Arkansas | -100.891064 | 24.448457 | 10     |
| Arizona   |    |          |             |           | 5      |
| Arkansas  |    |          |             |           | 1      |
| Somewhere |    |          |             |           | 5      |

This transformation lets you augment your data by fetching additional information from external sources, providing a more comprehensive dataset for analysis and visualization.
  `;
    },
  },
  filterByRefId: {
    name: 'Filter data by query refId',
    getHelperDocs: function (imageRenderType: ImageRenderType = ImageRenderType.ShortcodeFigure) {
      return `
Use this transformation to hide one or more queries in panels that have multiple queries.

Grafana displays the query identification letters in dark gray text. Click a query identifier to toggle filtering. If the query letter is white, then the results are displayed. If the query letter is dark, then the results are hidden.

> **Note:** This transformation is not available for Graphite because this data source does not support correlating returned data with queries.

In the example below, the panel has three queries (A, B, C). We removed the B query from the visualization.

${buildImageContent(
  '/static/img/docs/transformations/filter-by-query-stat-example-7-0.png',
  imageRenderType,
  'A stat visualization with results from two queries, A and C'
)}
  `;
    },
  },
  filterByValue: {
    name: 'Filter data by values',
    getHelperDocs: function () {
      return `
Use this transformation to selectively filter data points directly within your visualization. This transformation provides options to include or exclude data based on one or more conditions applied to a selected field.

This transformation is very useful if your data source does not natively filter by values. You might also use this to narrow values to display if you are using a shared query.

The available conditions for all fields are:

- **Regex** - Match a regex expression.
- **Is Null** - Match if the value is null.
- **Is Not Null** - Match if the value is not null.
- **Equal** - Match if the value is equal to the specified value.
- **Different** - Match if the value is different than the specified value.

The available conditions for string fields are:

- **Contains substring** - Match if the value contains the specified substring (case insensitive).
- **Does not contain substring** - Match if the value doesn't contain the specified substring (case insensitive).

The available conditions for number and time fields are:

- **Greater** - Match if the value is greater than the specified value.
- **Lower** - Match if the value is lower than the specified value.
- **Greater or equal** - Match if the value is greater or equal.
- **Lower or equal** - Match if the value is lower or equal.
- **Range** - Match a range between a specified minimum and maximum, min and max included. A time field will pre-populate with variables to filter by selected time.

Consider the following dataset:

#### Dataset Example

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

#### Transformed Data

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

When you have more than one condition, you can choose if you want the action (include/exclude) to be applied on rows that **Match all** conditions or **Match any** of the conditions you added.

In the example above, we chose **Match all** because we wanted to include the rows that have a temperature lower than 30°C *AND* an altitude higher than 100. If we wanted to include the rows that have a temperature lower than 30°C *OR* an altitude higher than 100 instead, then we would select **Match any**. This would include the first row in the original data, which has a temperature of 32°C (does not match the first condition) but an altitude of 101 (which matches the second condition), so it is included.

Conditions that are invalid or incompletely configured are ignored.

This versatile data filtering transformation lets you to selectively include or exclude data points based on specific conditions. Customize the criteria to tailor your data presentation to meet your unique analytical needs.
  `;
    },
  },
  filterFieldsByName: {
    name: 'Filter fields by name',
    getHelperDocs: function (imageRenderType: ImageRenderType = ImageRenderType.ShortcodeFigure) {
      return `
Use this transformation to selectively remove parts of your query results. There are three ways to filter field names:

- [Using a regular expression](#use-a-regular-expression)
- [Manually selecting included fields](#manually-select-included-fields)
- [Using a dashboard variable](#use-a-dashboard-variable)

#### Use a regular expression

When you filter using a regular expression, field names that match the regular expression are included. 

For example, from the input data:

| Time                | dev-eu-west | dev-eu-north | prod-eu-west | prod-eu-north |
| ------------------- | ----------- | ------------ | ------------ | ------------- |
| 2023-03-04 23:56:23 | 23.5        | 24.5         | 22.2         | 20.2          |
| 2023-03-04 23:56:23 | 23.6        | 24.4         | 22.1         | 20.1          |

The result from using the regular expression 'prod.*' would be:

| Time                | prod-eu-west | prod-eu-north |
| ------------------- | ------------ | ------------- |
| 2023-03-04 23:56:23 | 22.2         | 20.2          |
| 2023-03-04 23:56:23 | 22.1         | 20.1          |

The regular expression can include an interpolated dashboard variable by using the \${${'variableName'}} syntax.

#### Manually select included fields

Click and uncheck the field names to remove them from the result. Fields that are matched by the regular expression are still included, even if they're unchecked.

#### Use a dashboard variable

Enable 'From variable' to let you select a dashboard variable that's used to include fields. By setting up a [dashboard variable][] with multiple choices, the same fields can be displayed across multiple visualizations.

${buildImageContent(
  '/static/img/docs/transformations/filter-name-table-before-7-0.png',
  imageRenderType,
  'A table visualization with time, value, Min, and Max columns'
)}

Here's the table after we applied the transformation to remove the Min field.

${buildImageContent(
  '/static/img/docs/transformations/filter-name-table-after-7-0.png',
  imageRenderType,
  'A table visualization with time, value, and Max columns'
)}

Here is the same query using a Stat visualization.

${buildImageContent(
  '/static/img/docs/transformations/filter-name-stat-after-7-0.png',
  imageRenderType,
  'A stat visualization with value and Max fields'
)}

This transformation provides flexibility in tailoring your query results to focus on the specific fields you need for effective analysis and visualization.
  `;
    },
  },
  formatString: {
    name: 'Format string',
    getHelperDocs: function () {
      return `
Use this transformation to customize the output of a string field. This transformation has the following fields:

- **Upper case** - Formats the entire string in uppercase characters.
- **Lower case** - Formats the entire string in lowercase characters.
- **Sentence case** - Formats the first character of the string in uppercase.
- **Title case** - Formats the first character of each word in the string in uppercase.
- **Pascal case** - Formats the first character of each word in the string in uppercase and doesn't include spaces between words.
- **Camel case** - Formats the first character of each word in the string in uppercase, except the first word, and doesn't include spaces between words.
- **Snake case** - Formats all characters in the string in lowercase and uses underscores instead of spaces between words.
- **Kebab case** - Formats all characters in the string in lowercase and uses dashes instead of spaces between words.
- **Trim** - Removes all leading and trailing spaces from the string.
- **Substring** - Returns a substring of the string, using the specified start and end positions.

This transformation provides a convenient way to standardize and tailor the presentation of string data for better visualization and analysis.`;
    },
  },
  formatTime: {
    name: 'Format time',
    getHelperDocs: function () {
      return `
Use this transformation to customize the output of a time field. Output can be formatted using [Moment.js format strings](https://momentjs.com/docs/#/displaying/). For example, if you want to display only the year of a time field, the format string 'YYYY' can be used to show the calendar year (for example, 1999 or 2012).

**Before Transformation:**

| Timestamp           | Event        |
| ------------------- | ------------ |
| 1636678740000000000 | System Start |
| 1636678680000000000 | User Login   |
| 1636678620000000000 | Data Updated |

**After applying 'YYYY-MM-DD HH:mm:ss':**

| Timestamp           | Event        |
| ------------------- | ------------ |
| 2021-11-12 14:25:40 | System Start |
| 2021-11-12 14:24:40 | User Login   |
| 2021-11-12 14:23:40 | Data Updated |

This transformation lets you tailor the time representation in your visualizations, providing flexibility and precision in displaying temporal data.

> **Note:** This transformation is available in Grafana 10.1+ as an alpha feature.
  `;
    },
  },
  groupBy: {
    name: 'Group by',
    getHelperDocs: function () {
      return `
Use this transformation to group the data by a specified field (column) value and process calculations on each group. Click to see a list of calculation choices. For information about available calculations, refer to [Calculation types][].

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

All rows with the same value of Server ID are grouped together. Optionally, you can add a count of how may values fall in the selected group.

After choosing which field you want to group your data by, you can add various calculations on the other fields, and apply the calculation to each group of rows. For instance, we could want to calculate the average CPU temperature for each of those servers. So we can add the _mean_ calculation applied on the CPU Temperature field to get the following:

| Server ID | CPU Temperature (mean) |
| --------- | ---------------------- |
| server 1  | 82                     |
| server 2  | 88.6                   |
| server 3  | 59.6                   |

If you had added the count stat to the group by transformation, there would be an extra column showing that the count of each server from above was 3.

| Server ID | CPU Temperature (mean) | Server ID (count) |
| --------- | ---------------------- | ----------------- |
| server 1  | 82                     | 3                 |
| server 2  | 88.6                   | 3                 |
| server 3  | 59.6                   | 3                 |

And we can add more than one calculation. For instance:

- For field Time, we can calculate the _Last_ value, to know when the last data point was received for each server
- For field Server Status, we can calculate the _Last_ value to know what is the last state value for each server
- For field Temperature, we can also calculate the _Last_ value to know what is the latest monitored temperature for each server

We would then get:

| Server ID | CPU Temperature (mean) | CPU Temperature (last) | Time (last)         | Server Status (last) |
| --------- | ---------------------- | ---------------------- | ------------------- | -------------------- |
| server 1  | 82                     | 80                     | 2020-07-07 11:34:20 | Shutdown             |
| server 2  | 88.6                   | 90                     | 2020-07-07 10:32:20 | Overload             |
| server 3  | 59.6                   | 62                     | 2020-07-07 11:34:20 | OK                   |

This transformation allows you to extract essential information from your time series and present it conveniently.
  `;
    },
    links: [
      {
        title: 'Calculation types',
        url: 'https://grafana.com/docs/grafana/latest/panels-visualizations/calculation-types/',
      },
    ],
  },
  groupingToMatrix: {
    name: 'Grouping to matrix',
    getHelperDocs: function () {
      return `
Use this transformation to combine three fields—which are used as input for the **Column**, **Row**, and **Cell value** fields from the query output—and generate a matrix. The matrix is calculated as follows:

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

Use this transformation to construct a matrix by specifying fields from your query results. The matrix output reflects the relationships between the unique values in these fields. This helps you present complex relationships in a clear and structured matrix format.
  `;
    },
  },
  groupToNestedTable: {
    name: 'Group to nested tables',
    getHelperDocs: function (imageRenderType: ImageRenderType = ImageRenderType.ShortcodeFigure) {
      return `
  Use this transformation to group the data by a specified field (column) value and process calculations on each group. Records are generated that share the same grouped field value, to be displayed in a nested table.
    
  To calculate a statistic for a field, click the selection box next to it and select the **Calculate** option:

  ${buildImageContent(
    '/static/img/docs/transformations/nested-table-select-calculation.png',
    imageRenderType,
    'A select box showing the Group and Calculate options for the transformation.'
  )}

  Once **Calculate** has been selected, another selection box will appear next to the respective field which will allow statistics to be selected:

  ${buildImageContent(
    '/static/img/docs/transformations/nested-table-select-stat.png',
    imageRenderType,
    'A select box showing available statistic calculations once the calculate option for the field has been selected.'
  )}

  For information about available calculations, refer to [Calculation types][].

  Here's an example of original data:

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

  This transformation has two steps. First, specify one or more fields by which to group the data. This groups all the same values of those fields together, as if you sorted them. For instance, if you group by the Server ID field, Grafana groups the data this way:

  | Server ID      |  |
  | -------------- | ------------- |
  | server 1 | <table><th><tr><td>Time</td><td>CPU Temperature</td><td>Server Status</td></tr></th><tbody><tr><td>2020-07-07 11:34:20</td><td>80</td><td>Shutdown</td></tr><tr><td>2020-07-07 09:28:06</td><td>80</td><td>OK</td></tr><tr><td>2020-07-07 09:23:07</td><td>86</td><td>OK</td></tr></tbody></table> |
  | server 2 | <table><th><tr><td>Time</td><td>CPU Temperature</td><td>Server Status</td></tr></th><tbody><tr><td>2020-07-07 10:32:20</td><td>90</td><td>Overload</td></tr><tr><td>2020-07-07 09:30:05</td><td>88</td><td>OK</td></tr><tr><td>2020-07-07 09:25:05</td><td>88</td><td>OK</td></tr></tbody></table> |
  | server 3 | <table><th><tr><td>Time</td><td>CPU Temperature</td><td>Server Status</td></tr></th><tbody><tr><td>2020-07-07 11:34:20</td><td>62</td><td>OK</td></tr><tr><td>2020-07-07 10:31:22</td><td>55</td><td>OK</td></tr><tr><td>2020-07-07 09:30:57</td><td>62</td><td>Rebooting</td></tr></tbody></table> |

  After choosing the field by which you want to group your data, you can add various calculations on the other fields and apply the calculation to each group of rows. For instance, you might want to calculate the average CPU temperature for each of those servers. To do so, add the **mean calculation** applied on the CPU Temperature field to get the following result:

  | Server ID      | CPU Temperatute (mean) | |
  | -------------- | ------------- | ------------- |
  | server 1 | 82 | <table><th><tr><td>Time</td><td>Server Status</td></tr></th><tbody><tr><td>2020-07-07 11:34:20</td><td>Shutdown</td></tr><tr><td>2020-07-07 09:28:06</td><td>OK</td></tr><tr><td>2020-07-07 09:23:07</td><td>OK</td></tr></tbody></table> |
  | server 2 | 88.6 | <table><th><tr><td>Time</td><td>Server Status</td></tr></th><tbody><tr><td>2020-07-07 10:32:20</td><td>Overload</td></tr><tr><td>2020-07-07 09:30:05</td><td>OK</td></tr><tr><td>2020-07-07 09:25:05</td><td>OK</td></tr></tbody></table> |
  | server 3 | 59.6 | <table><th><tr><td>Time</td><td>Server Status</td></tr></th><tbody><tr><td>2020-07-07 11:34:20</td><td>OK</td></tr><tr><td>2020-07-07 10:31:22</td><td>OK</td></tr><tr><td>2020-07-07 09:30:57</td><td>Rebooting</td></tr></tbody></table> |
      `;
    },
    links: [
      {
        title: 'Calculation types',
        url: 'https://grafana.com/docs/grafana/latest/panels-visualizations/calculation-types/',
      },
    ],
  },
  heatmap: {
    name: 'Create heatmap',
    getHelperDocs: function () {
      return `
Use this transformation to prepare histogram data for visualizing trends over time. Similar to the heatmap visualization, this transformation converts histogram metrics into temporal buckets.

#### X Bucket

This setting determines how the x-axis is split into buckets.

- **Size** - Specify a time interval in the input field. For example, a time range of '1h' creates cells one hour wide on the x-axis.
- **Count** - For non-time-related series, use this option to define the number of elements in a bucket.

#### Y Bucket

This setting determines how the y-axis is split into buckets.

- **Linear**
- **Logarithmic** - Choose between log base 2 or log base 10.
- **Symlog** - Uses a symmetrical logarithmic scale. Choose between log base 2 or log base 10, allowing for negative values.

Assume you have the following dataset:

| Timestamp           | Value |
|-------------------- |-------|
| 2023-01-01 12:00:00 | 5     |
| 2023-01-01 12:15:00 | 10    |
| 2023-01-01 12:30:00 | 15    |
| 2023-01-01 12:45:00 | 8     |

- With X Bucket set to 'Size: 15m' and Y Bucket as 'Linear', the histogram organizes values into time intervals of 15 minutes on the x-axis and linearly on the y-axis.
- For X Bucket as 'Count: 2' and Y Bucket as 'Logarithmic (base 10)', the histogram groups values into buckets of two on the x-axis and use a logarithmic scale on the y-axis.
  `;
    },
  },
  histogram: {
    name: 'Histogram',
    getHelperDocs: function () {
      return `
Use this transformation to generate a histogram based on input data, allowing you to visualize the distribution of values.

- **Bucket size** - The range between the lowest and highest items in a bucket (xMin to xMax).
- **Bucket offset** - The offset for non-zero-based buckets.
- **Combine series** - Create a unified histogram using all available series.

**Original data**

Series 1:

| A | B | C |
| - | - | - |
| 1 | 3 | 5 |
| 2 | 4 | 6 |
| 3 | 5 | 7 |
| 4 | 6 | 8 |
| 5 | 7 | 9 |

Series 2:

| C |
| - |
| 5 |
| 6 |
| 7 |
| 8 |
| 9 |

**Output**

| xMin | xMax | A | B | C | C |
| ---- | ---- | --| --| --| --|
| 1    | 2    | 1 | 0 | 0 | 0 |
| 2    | 3    | 1 | 0 | 0 | 0 |
| 3    | 4    | 1 | 1 | 0 | 0 |
| 4    | 5    | 1 | 1 | 0 | 0 |
| 5    | 6    | 1 | 1 | 1 | 1 |
| 6    | 7    | 0 | 1 | 1 | 1 |
| 7    | 8    | 0 | 1 | 1 | 1 |
| 8    | 9    | 0 | 0 | 1 | 1 |
| 9    | 10   | 0 | 0 | 1 | 1 |

Visualize the distribution of values using the generated histogram, providing insights into the data's spread and density.
  `;
    },
  },
  joinByField: {
    name: 'Join by field',
    getHelperDocs: function (imageRenderType: ImageRenderType = ImageRenderType.ShortcodeFigure) {
      return `
Use this transformation to merge multiple results into a single table, enabling the consolidation of data from different queries.

This is especially useful for converting multiple time series results into a single wide table with a shared time field.

#### Inner join (for Time Series or SQL-like data)

An inner join merges data from multiple tables where all tables share the same value from the selected field. This type of join excludes data where values do not match in every result.

Use this transformation to combine the results from multiple queries (combining on a passed join field or the first time column) into one result, and drop rows where a successful join cannot occur. This is not optimized for large Time Series datasets.

In the following example, two queries return Time Series data. It is visualized as two separate tables before applying the inner join transformation.

**Query A:**

| Time                | Job     | Uptime    |
| ------------------- | ------- | --------- |
| 2020-07-07 11:34:20 | node    | 25260122  |
| 2020-07-07 11:24:20 | postgre | 123001233 |
| 2020-07-07 11:14:20 | postgre | 345001233 |

**Query B:**

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

This works in the same way for non-Time Series tabular data as well.

**Students**

| StudentID | Name     | Major            |
| --------- | -------- | ---------------- |
| 1         | John     | Computer Science |
| 2         | Emily    | Mathematics      |
| 3         | Michael  | Physics          |
| 4         | Jennifer | Chemistry        |

**Enrollments**

| StudentID | CourseID | Grade |
|-----------|----------|-------|
| 1         | CS101    | A     |
| 1         | CS102    | B     |
| 2         | MATH201  | A     |
| 3         | PHYS101  | B     |
| 5         | HIST101  | B     |

The result after applying the inner join transformation looks like the following:

| StudentID | Name    | Major            | CourseID | Grade |
| --------- | ------- | ---------------- | -------  | ----- |
| 1         | John    | Computer Science | CS101    | A     |
| 1         | John    | Computer Science | CS102    | B     |
| 2         | Emily   | Mathematics      | MATH201  | A     |
| 3         | Michael | Physics          | PHYS101  | B     |

The inner join only includes rows where there is a match between the "StudentID" in both tables. In this case, the result does not include "Jennifer" from the "Students" table because there are no matching enrollments for her in the "Enrollments" table.

#### Outer join (for Time Series data)

An outer join includes all data from an inner join and rows where values do not match in every input. While the inner join joins Query A and Query B on the time field, the outer join includes all rows that don't match on the time field.

In the following example, two queries return table data. It is visualized as two tables before applying the outer join transformation.

**Query A:**

| Time                | Job     | Uptime    |
| ------------------- | ------- | --------- |
| 2020-07-07 11:34:20 | node    | 25260122  |
| 2020-07-07 11:24:20 | postgre | 123001233 |
| 2020-07-07 11:14:20 | postgre | 345001233 |

**Query B:**

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

In the following example, a template query displays time series data from multiple servers in a table visualization. The results of only one query can be viewed at a time.

${buildImageContent(
  '/static/img/docs/transformations/join-fields-before-7-0.png',
  imageRenderType,
  'A table visualization showing results for one server'
)}

I applied a transformation to join the query results using the time field. Now I can run calculations, combine, and organize the results in this new table.

${buildImageContent(
  '/static/img/docs/transformations/join-fields-after-7-0.png',
  imageRenderType,
  'A table visualization showing results for multiple servers'
)}

#### Outer join (for SQL-like data)

A tabular outer join combining tables so that the result includes matched and unmatched rows from either or both tables.

| StudentID | Name      | Major            |
| --------- | --------- | ---------------- |
| 1         | John      | Computer Science |
| 2         | Emily     | Mathematics      |
| 3         | Michael   | Physics          |
| 4         | Jennifer  | Chemistry        |

Can now be joined with:

| StudentID | CourseID | Grade |
| --------- | -------- | ----- |
| 1         | CS101    | A     |
| 1         | CS102    | B     |
| 2         | MATH201  | A     |
| 3         | PHYS101  | B     |
| 5         | HIST101  | B     |

The result after applying the outer join transformation looks like the following:

| StudentID | Name     | Major            | CourseID | Grade |
| --------- | -------- | ---------------- | -------- | ----- |
| 1         | John     | Computer Science | CS101    | A     |
| 1         | John     | Computer Science | CS102    | B     |
| 2         | Emily    | Mathematics      | MATH201  | A     |
| 3         | Michael  | Physics          | PHYS101  | B     |
| 4         | Jennifer | Chemistry        | NULL     | NULL  |
| 5         | NULL     | NULL             | HIST101  | B     |

Combine and analyze data from various queries with table joining for a comprehensive view of your information.
  `;
    },
  },
  joinByLabels: {
    name: 'Join by labels',
    getHelperDocs: function () {
      return `
Use this transformation to join multiple results into a single table.

This is especially useful for converting multiple time series results into a single wide table with a shared **Label** field.

- **Join** - Select the label to join by between the labels available or common across all time series.
- **Value** - The name for the output result.

#### Example

##### Input

series1{what="Temp", cluster="A", job="J1"}

| Time | Value |
| ---- | ----- |
| 1    | 10    |
| 2    | 200   |

series2{what="Temp", cluster="B", job="J1"}

| Time | Value |
| ---- | ----- |
| 1    | 10    |
| 2    | 200   |

series3{what="Speed", cluster="B", job="J1"}

| Time | Value |
| ---- | ----- |
| 22   | 22    |
| 28   | 77    |

##### Config

value: "what"

##### Output

| cluster | job | Temp | Speed |
| ------- | --- | ---- | ----- |
| A       | J1  | 10   |       |
| A       | J1  | 200  |       |
| B       | J1  | 10   | 22    |
| B       | J1  | 200  | 77    |

Combine and organize time series data effectively with this transformation for comprehensive insights.
  `;
    },
  },
  labelsToFields: {
    name: 'Labels to fields',
    getHelperDocs: function () {
      return `
Use this transformation to convert time series results with labels or tags into a table, including each label's keys and values in the result. Display labels as either columns or row values for enhanced data visualization.

Given a query result of two time series:

- Series 1: labels Server=Server A, Datacenter=EU
- Series 2: labels Server=Server B, Datacenter=EU

In "Columns" mode, the result looks like this:

| Time                | Server   | Datacenter | Value |
| ------------------- | -------- | ---------- | ----- |
| 2020-07-07 11:34:20 | Server A | EU         | 1     |
| 2020-07-07 11:34:20 | Server B | EU         | 2     |

In "Rows" mode, the result has a table for each series and show each label value like this:

| label      | value    |
| ---------- | -------- |
| Server     | Server A |
| Datacenter | EU       |

| label      | value    |
| ---------- | -------- |
| Server     | Server B |
| Datacenter | EU       |

#### Value field name

If you selected Server as the **Value field name**, then you would get one field for every value of the Server label.

| Time                | Datacenter | Server A | Server B |
| ------------------- | ---------- | -------- | -------- |
| 2020-07-07 11:34:20 | EU         | 1        | 2        |

#### Merging behavior

The labels to fields transformer is internally two separate transformations. The first acts on single series and extracts labels to fields. The second is the [merge](#merge) transformation that joins all the results into a single table. The merge transformation tries to join on all matching fields. This merge step is required and cannot be turned off.

To illustrate this, here is an example where you have two queries that return time series with no overlapping labels.

- Series 1: labels Server=ServerA
- Series 2: labels Datacenter=EU

This will first result in these two tables:

| Time                | Server  | Value |
| ------------------- | ------- | ----- |
| 2020-07-07 11:34:20 | ServerA | 10    |

| Time                | Datacenter | Value |
| ------------------- | ---------- | ----- |
| 2020-07-07 11:34:20 | EU         | 20    |

After merge:

| Time                | Server  | Value | Datacenter |
| ------------------- | ------- | ----- | ---------- |
| 2020-07-07 11:34:20 | ServerA | 10    |            |
| 2020-07-07 11:34:20 |         | 20    | EU         |

Convert your time series data into a structured table format for a clearer and more organized representation.
  `;
    },
  },
  limit: {
    name: 'Limit',
    getHelperDocs: function () {
      return `
Use this transformation to restrict the number of rows displayed, providing a more focused view of your data. This is particularly useful when dealing with large datasets.

Below is an example illustrating the impact of the **Limit** transformation on a response from a data source:

| Time                | Metric      | Value |
| ------------------- | ----------- | ----- |
| 2020-07-07 11:34:20 | Temperature | 25    |
| 2020-07-07 11:34:20 | Humidity    | 22    |
| 2020-07-07 10:32:20 | Humidity    | 29    |
| 2020-07-07 10:31:22 | Temperature | 22    |
| 2020-07-07 09:30:57 | Humidity    | 33    |
| 2020-07-07 09:30:05 | Temperature | 19    |

Here is the result after adding a Limit transformation with a value of '3':

| Time                | Metric      | Value |
| ------------------- | ----------- | ----- |
| 2020-07-07 11:34:20 | Temperature | 25    |
| 2020-07-07 11:34:20 | Humidity    | 22    |
| 2020-07-07 10:32:20 | Humidity    | 29    |

Using a negative number, you can keep values from the end of the set. Here is the result after adding a Limit transformation with a value of '-3':

| Time                | Metric      | Value |
| ------------------- | ----------- | ----- |
| 2020-07-07 10:31:22 | Temperature | 22    |
| 2020-07-07 09:30:57 | Humidity    | 33    |
| 2020-07-07 09:30:05 | Temperature | 19    |


This transformation helps you tailor the visual presentation of your data to focus on the most relevant information.
  `;
    },
  },
  merge: {
    name: 'Merge series/tables',
    getHelperDocs: function () {
      return `
Use this transformation to combine the results from multiple queries into a single result, which is particularly useful when using the table panel visualization. This transformation merges values into the same row if the shared fields contain the same data.

Here's an example illustrating the impact of the **Merge series/tables** transformation on two queries returning table data:

**Query A:**

| Time                | Job     | Uptime    |
| ------------------- | ------- | --------- |
| 2020-07-07 11:34:20 | node    | 25260122  |
| 2020-07-07 11:24:20 | postgre | 123001233 |

**Query B:**

| Time                | Job     | Errors |
| ------------------- | ------- | ------ |
| 2020-07-07 11:34:20 | node    | 15     |
| 2020-07-07 11:24:20 | postgre | 5      |

Here is the result after applying the Merge transformation.

| Time                | Job     | Errors | Uptime    |
| ------------------- | ------- | ------ | --------- |
| 2020-07-07 11:34:20 | node    | 15     | 25260122  |
| 2020-07-07 11:24:20 | postgre | 5      | 123001233 |

This transformation combines values from Query A and Query B into a unified table, enhancing the presentation of data for better insights.
  `;
    },
    links: [
      {
        title: 'Table panel',
        url: 'https://grafana.com/docs/grafana/latest/panels-visualizations/visualizations/table/',
      },
    ],
  },
  organize: {
    name: 'Organize fields by name',
    getHelperDocs: function () {
      return `
Use this transformation to provide the flexibility to rename, reorder, or hide fields returned by a single query in your panel. This transformation is applicable only to panels with a single query. If your panel has multiple queries, consider using an "Outer join" transformation or removing extra queries.

#### Transforming fields

Grafana displays a list of fields returned by the query, allowing you to perform the following actions:

- **Set field order mode** - If the mode is **Manual**, you can change the field order by hovering the cursor over a field and dragging the field to its new position. If it's **Auto**, use the **OFF**, **ASC**, and **DESC** options to order by any labels on the field or by the field name. For any field that is sorted **ASC** or **DESC**, you can drag the option to set the priority of the sorting.
- **Change field order** - Hover over a field, and when your cursor turns into a hand, drag the field to its new position.
- **Hide or show a field** - Use the eye icon next to the field name to toggle the visibility of a specific field.
- **Rename fields** - Type a new name in the "Rename <field>" box to customize field names.

#### Example:

##### Original Query Result

| Time                | Metric      | Value |
| ------------------- | ----------- | ----- |
| 2020-07-07 11:34:20 | Temperature | 25    |
| 2020-07-07 11:34:20 | Humidity    | 22    |
| 2020-07-07 10:32:20 | Humidity    | 29    |

##### After Applying Field Overrides

| Time                | Sensor      | Reading |
| ------------------- | ----------- | ------- |
| 2020-07-07 11:34:20 | Temperature | 25      |
| 2020-07-07 11:34:20 | Humidity    | 22      |
| 2020-07-07 10:32:20 | Humidity    | 29      |

This transformation lets you to tailor the display of query results, ensuring a clear and insightful representation of your data in Grafana.
  `;
    },
  },
  partitionByValues: {
    name: 'Partition by values',
    getHelperDocs: function () {
      return `
Use this transformation to streamline the process of graphing multiple series without the need for multiple queries with different 'WHERE' clauses.

This is particularly useful when dealing with a metrics SQL table, as illustrated below:

| Time                | Region | Value |
| ------------------- | ------ | ----- |
| 2022-10-20 12:00:00 | US     | 1520  |
| 2022-10-20 12:00:00 | EU     | 2936  |
| 2022-10-20 01:00:00 | US     | 1327  |
| 2022-10-20 01:00:00 | EU     | 912   |

With the **Partition by values** transformation, you can issue a single query and split the results by unique values in one or more columns (fields) of your choosing. The following example uses 'Region':

'SELECT Time, Region, Value FROM metrics WHERE Time > "2022-10-20"'

| Time                | Region | Value |
| ------------------- | ------ | ----- |
| 2022-10-20 12:00:00 | US     | 1520  |
| 2022-10-20 01:00:00 | US     | 1327  |

| Time                | Region | Value |
| ------------------- | ------ | ----- |
| 2022-10-20 12:00:00 | EU     | 2936  |
| 2022-10-20 01:00:00 | EU     | 912   |

This transformation simplifies the process and enhances the flexibility of visualizing multiple series within the same time series visualization.
  `;
    },
  },
  prepareTimeSeries: {
    name: 'Prepare time series',
    getHelperDocs: function () {
      return `
Use this transformation to address issues when a data source returns time series data in a format that isn't compatible with the desired visualization. This transformation allows you to convert time series data between wide and long formats, providing flexibility in data frame structures.

#### Available options

##### Wide time series

Select this option to transform the time series data frame from the long format to the wide format. If your data source returns time series data in a long format and your visualization requires a wide format, this transformation simplifies the process.

A wide time series combines data into a single frame with one shared, ascending time field. Time fields do not repeat and multiple values extend in separate columns.

**Example: Converting from long to wide format**

| Timestamp           | Variable | Value |
|---------------------|----------|-------|
| 2023-01-01 00:00:00 | Value1   | 10    |
| 2023-01-01 00:00:00 | Value2   | 20    |
| 2023-01-01 01:00:00 | Value1   | 15    |
| 2023-01-01 01:00:00 | Value2   | 25    |

**Transformed to:**

| Timestamp           | Value1 | Value2 |
|---------------------|--------|--------|
| 2023-01-01 00:00:00 | 10     | 20     |
| 2023-01-01 01:00:00 | 15     | 25     |

##### Multi-frame time series

Multi-frame time series break data into multiple frames that all contain two fields: a time field and a numeric value field. Time is always ascending. String values are represented as field labels.

##### Long time series

A long time series combines data into one frame, with the first field being an ascending time field. The time field might have duplicates. String values are in separate fields, and there might be more than one. 

**Example: Converting to long format**

| Value1 | Value2 |  Timestamp          |
|--------|--------|---------------------|
| 10     | 20     | 2023-01-03 00:00:00 |
| 30     | 40     | 2023-01-02 00:00:00 |
| 50     | 60     | 2023-01-01 00:00:00 |
| 70     | 80     | 2023-01-01 00:00:00 |

**Transformed to:**

| Timestamp           | Value1 | Value2 |
|---------------------|--------|--------|
| 2023-01-01 00:00:00 | 70     | 80     |
| 2023-01-01 01:00:00 | 50     | 60     |
| 2023-01-02 01:00:00 | 30     | 40     |
| 2023-01-03 01:00:00 | 10     | 20     |

  `;
    },
    links: [
      {
        title: 'Data frames',
        url: 'https://grafana.com/docs/grafana/latest/developers/plugins/introduction-to-plugin-development/data-frames/',
      },
    ],
  },
  reduce: {
    name: 'Reduce',
    getHelperDocs: function () {
      return `
Use this transformation to apply a calculation to each field in the data frame and return a single value. This transformation is particularly useful for consolidating multiple time series data into a more compact, summarized format. Time fields are removed when applying this transformation.

Consider the input:

**Query A:**

| Time                | Temp | Uptime  |
| ------------------- | ---- | ------- |
| 2020-07-07 11:34:20 | 12.3 | 256122  |
| 2020-07-07 11:24:20 | 15.4 | 1230233 |

**Query B:**

| Time                | AQI | Errors |
| ------------------- | --- | ------ |
| 2020-07-07 11:34:20 | 6.5 | 15     |
| 2020-07-07 11:24:20 | 3.2 | 5      |

The reduce transformer has two modes:

- **Series to rows** - Creates a row for each field and a column for each calculation.
- **Reduce fields** - Keeps the existing frame structure, but collapses each field into a single value.

For example, if you used the **First** and **Last** calculation with a **Series to rows** transformation, then
the result would be:

| Field  | First  | Last    |
| ------ | ------ | ------- |
| Temp   | 12.3   | 15.4    |
| Uptime | 256122 | 1230233 |
| AQI    | 6.5    | 3.2     |
| Errors | 15     | 5       |

The **Reduce fields** with the **Last** calculation,
results in two frames, each with one row:

**Query A:**

| Temp | Uptime  |
| ---- | ------- |
| 15.4 | 1230233 |

**Query B:**

| AQI | Errors |
| --- | ------ |
| 3.2 | 5      |

This flexible transformation simplifies the process of consolidating and summarizing data from multiple time series into a more manageable and organized format.
  `;
    },
  },
  renameByRegex: {
    name: 'Rename by regex',
    getHelperDocs: function (imageRenderType: ImageRenderType = ImageRenderType.ShortcodeFigure) {
      return `
Use this transformation to rename parts of the query results using a regular expression and replacement pattern.

You can specify a regular expression, which is only applied to matches, along with a replacement pattern that support back references. For example, let's imagine you're visualizing CPU usage per host and you want to remove the domain name. You could set the regex to '/^([^.]+).*/' and the replacement pattern to '$1', 'web-01.example.com' would become 'web-01'.

> **Note:** The Rename by regex transformation was improved in Grafana v9.0.0 to allow global patterns of the form '/<stringToReplace>/g'. Depending on the regex match used, this may cause some transformations to behave slightly differently. You can guarantee the same behavior as before by wrapping the match string in forward slashes '(/)', e.g. '(.*)' would become '/(.*)/'.

In the following example, we are stripping the 'A-' prefix from field names. In the before image, you can see everything is prefixed with 'A-':

${buildImageContent(
  '/media/docs/grafana/panels-visualizations/screenshot-rename-by-regex-before-v11.0.png',
  imageRenderType,
  'A time series with full series names'
)}

With the transformation applied, you can see we are left with just the remainder of the string.

${buildImageContent(
  '/media/docs/grafana/panels-visualizations/screenshot-rename-by-regex-after-v11.0.png',
  imageRenderType,
  'A time series with shortened series names'
)}

This transformation lets you to tailor your data to meet your visualization needs, making your dashboards more informative and user-friendly.
  `;
    },
  },
  rowsToFields: {
    name: 'Rows to fields',
    getHelperDocs: function () {
      return `
Use this transformation to convert rows into separate fields. This can be useful because fields can be styled and configured individually. It can also use additional fields as sources for dynamic field configuration or map them to field labels. The additional labels can then be used to define better display names for the resulting fields.

This transformation includes a field table which lists all fields in the data returned by the configuration query. This table gives you control over what field should be mapped to each configuration property (the **Use as** option). You can also choose which value to select if there are multiple rows in the returned data.

This transformation requires:

- One field to use as the source of field names.

  By default, the transform uses the first string field as the source. You can override this default setting by selecting **Field name** in the **Use as** column for the field you want to use instead.

- One field to use as the source of values.

  By default, the transform uses the first number field as the source. But you can override this default setting by selecting **Field value** in the **Use as** column for the field you want to use instead.

Useful when visualizing data in:

- Gauge
- Stat
- Pie chart

#### Map extra fields to labels

If a field does not map to config property Grafana will automatically use it as source for a label on the output field-

**Example:**

| Name    | DataCenter | Value |
| ------- | ---------- | ----- |
| ServerA | US         | 100   |
| ServerB | EU         | 200   |

**Output:**

| ServerA (labels: DataCenter: US) | ServerB (labels: DataCenter: EU) |
| -------------------------------- | -------------------------------- |
| 10                               | 20                               |

The extra labels can now be used in the field display name provide more complete field names.

If you want to extract config from one query and apply it to another you should use the config from query results transformation.

#### Example

**Input:**

| Name    | Value | Max |
| ------- | ----- | --- |
| ServerA | 10    | 100 |
| ServerB | 20    | 200 |
| ServerC | 30    | 300 |

**Output:**

| ServerA (config: max=100) | ServerB (config: max=200) | ServerC (config: max=300) |
| ------------------------- | ------------------------- | ------------------------- |
| 10                        | 20                        | 30                        |

As you can see each row in the source data becomes a separate field. Each field now also has a max config option set. Options like **Min**, **Max**, **Unit** and **Thresholds** are all part of field configuration and if set like this will be used by the visualization instead of any options manually configured in the panel editor options pane.

This transformation enables the conversion of rows into individual fields, facilitates dynamic field configuration, and maps additional fields to labels.
  `;
    },
  },
  seriesToRows: {
    name: 'Series to rows',
    getHelperDocs: function () {
      return `
Use this transformation to combine the result from multiple time series data queries into one single result. This is helpful when using the table panel visualization.

The result from this transformation will contain three columns: Time, Metric, and Value. The Metric column is added so you easily can see from which query the metric originates from. Customize this value by defining Label on the source query.

In the example below, we have two queries returning time series data. It is visualized as two separate tables before applying the transformation.

**Query A:**

| Time                | Temperature |
| ------------------- | ----------- |
| 2020-07-07 11:34:20 | 25          |
| 2020-07-07 10:31:22 | 22          |
| 2020-07-07 09:30:05 | 19          |

**Query B:**

| Time                | Humidity |
| ------------------- | -------- |
| 2020-07-07 11:34:20 | 24       |
| 2020-07-07 10:32:20 | 29       |
| 2020-07-07 09:30:57 | 33       |

Here is the result after applying the Series to rows transformation.

| Time                | Metric      | Value |
| ------------------- | ----------- | ----- |
| 2020-07-07 11:34:20 | Temperature | 25    |
| 2020-07-07 11:34:20 | Humidity    | 22    |
| 2020-07-07 10:32:20 | Humidity    | 29    |
| 2020-07-07 10:31:22 | Temperature | 22    |
| 2020-07-07 09:30:57 | Humidity    | 33    |
| 2020-07-07 09:30:05 | Temperature | 19    |

This transformation facilitates the consolidation of results from multiple time series queries, providing a streamlined and unified dataset for efficient analysis and visualization in a tabular format.

  `;
    },
  },
  sortBy: {
    name: 'Sort by',
    getHelperDocs: function () {
      return `
Use this transformation to sort each frame within a query result based on a specified field, making your data easier to understand and analyze. By configuring the desired field for sorting, you can control the order in which the data is presented in the table or visualization.

Use the **Reverse** switch to inversely order the values within the specified field. This functionality is particularly useful when you want to quickly toggle between ascending and descending order to suit your analytical needs.

For example, in a scenario where time-series data is retrieved from a data source, the **Sort by** transformation can be applied to arrange the data frames based on the timestamp, either in ascending or descending order, depending on the analytical requirements. This capability ensures that you can easily navigate and interpret time-series data, gaining valuable insights from the organized and visually coherent presentation.
  `;
    },
  },
  spatial: {
    name: 'Spatial',
    getHelperDocs: function () {
      return `
Use this transformation to apply spatial operations to query results.

- **Action** - Select an action:
  - **Prepare spatial field** - Set a geometry field based on the results of other fields.
    - **Location mode** - Select a location mode (these options are shared by the **Calculate value** and **Transform** modes):
      - **Auto** - Automatically identify location data based on default field names.
      - **Coords** - Specify latitude and longitude fields.
      - **Geohash** - Specify a geohash field.
      - **Lookup** - Specify Gazetteer location fields.
  - **Calculate value** - Use the geometry to define a new field (heading/distance/area).
    - **Function** - Choose a mathematical operation to apply to the geometry:
      - **Heading** - Calculate the heading (direction) between two points.
      - **Area** - Calculate the area enclosed by a polygon defined by the geometry.
      - **Distance** - Calculate the distance between two points.
  - **Transform** - Apply spatial operations to the geometry.
    - **Operation** - Choose an operation to apply to the geometry:
      - **As line** - Create a single line feature with a vertex at each row.
      - **Line builder** - Create a line between two points.

This transformation allows you to manipulate and analyze geospatial data, enabling operations such as creating lines between points, calculating spatial properties, and more.
  `;
    },
  },
  timeSeriesTable: {
    name: 'Time series to table transform',
    getHelperDocs: function (imageRenderType: ImageRenderType = ImageRenderType.ShortcodeFigure) {
      return `
Use this transformation to convert time series results into a table, transforming a time series data frame into a **Trend** field which can then be used with the [sparkline cell type][]. If there are multiple time series queries, each will result in a separate table data frame. These can be joined using join or merge transforms to produce a single table with multiple sparklines per row.

${buildImageContent(
  '/static/img/docs/transformations/table-sparklines.png',
  imageRenderType,
  'A table panel showing multiple values and their corresponding sparklines.'
)}

For each generated **Trend** field value, a calculation function can be selected. This value is displayed next to the sparkline and will be used for sorting table rows.

${buildImageContent(
  '/static/img/docs/transformations/timeseries-table-select-stat.png',
  imageRenderType,
  'A select box showing available statistics that can be calculated.'
)}


> **Note:** This transformation is available in Grafana 9.5+ as an opt-in beta feature. Modify the Grafana [configuration file][] to use it.
  `;
    },
    links: [
      {
        title: 'sparkline cell type',
        url: 'https://grafana.com/docs/grafana/latest/panels-visualizations/visualizations/table/#sparkline',
      },
      {
        title: 'configuration file',
        url: 'https://grafana.com/docs/grafana/latest/setup-grafana/configure-grafana/',
      },
    ],
  },
  transpose: {
    name: 'Transpose',
    getHelperDocs: function (imageRenderType: ImageRenderType = ImageRenderType.ShortcodeFigure) {
      return `
Use this transformation to pivot the data frame, converting rows into columns and columns into rows. This transformation is particularly useful when you want to switch the orientation of your data to better suit your visualization needs.
If you have multiple types, it will default to string type. You can select how empty cells should be represented.

**Before Transformation:**

| env  | January   | February |
| ---- | --------- | -------- |
| prod | 1 | 2 |
| dev | 3 | 4 |

**After applying transpose transformation:**

| Field  | prod   | dev |
| ---- | --------- | -------- |
| January | 1 | 3 |
| February  | 2 | 4 |

${buildImageContent(
  '/media/docs/grafana/transformations/screenshot-grafana-11-2-transpose-transformation.png',
  imageRenderType,
  'Before and after transpose transformation'
)}
  `;
    },
  },
  regression: {
    name: 'Trendline',
    getHelperDocs: function (imageRenderType: ImageRenderType = ImageRenderType.ShortcodeFigure) {
      return `
Use this transformation to create a new data frame containing values predicted by a statistical model. This is useful for finding a trend in chaotic data. It works by fitting a mathematical function to the data, using either linear or polynomial regression. The data frame can then be used in a visualization to display a trendline.

There are two different models:

- **Linear** - Fits a linear function to the data.
${buildImageContent(
  '/static/img/docs/transformations/linear-regression.png',
  imageRenderType,
  'A time series visualization with a straight line representing the linear function'
)}
- **Polynomial** - Fits a polynomial function to the data.
${buildImageContent(
  '/static/img/docs/transformations/polynomial-regression.png',
  imageRenderType,
  'A time series visualization with a curved line representing the polynomial function'
)}

> **Note:** This transformation was previously called regression analysis.
  `;
    },
  },
};

export function getLinkToDocs(): string {
  return `
  Go to the <a href="https://grafana.com/docs/grafana/latest/panels/transformations/?utm_source=grafana" target="_blank" rel="noreferrer">
  transformation documentation
  </a> for more general documentation.
  `;
}

function buildImageContent(source: string, imageRenderType: ImageRenderType, imageAltText: string) {
  return imageRenderType === 'shortcodeFigure'
    ? // This will build a Hugo Shortcode "figure" image template, which shares the same default class and max-width.
      `{{< figure src="${source}" class="docs-image--no-shadow" max-width= "1100px" alt="${imageAltText}" >}}`
    : // This will build generic Markdown image syntax for UI rendering.
      `![${imageAltText}](https://grafana.com${source})`;
}
