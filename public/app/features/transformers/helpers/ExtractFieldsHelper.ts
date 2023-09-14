import { getLinkToDocs } from './getLinkToDocs';

export const extractFieldsHelper = () => {
  return `
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
  ${getLinkToDocs()}
  `;
};
