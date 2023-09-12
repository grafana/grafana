export const LabelsToFieldsHelper = () => {
  return `
  This transformation changes time series results that include labels or tags into a table where each label keys and values are included in the table result. The labels can be displayed either as columns or as row values.

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
  `;
};
