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
  `;
};
