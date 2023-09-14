export const reduceHelper = () => {
  return `
  The _Reduce_ transformation applies a calculation to each field in the frame and return a single value. Time fields are removed when applying this transformation.

  Consider the input:

  Query A:

  | Time                | Temp | Uptime  |
  | ------------------- | ---- | ------- |
  | 2020-07-07 11:34:20 | 12.3 | 256122  |
  | 2020-07-07 11:24:20 | 15.4 | 1230233 |

  Query B:

  | Time                | AQI | Errors |
  | ------------------- | --- | ------ |
  | 2020-07-07 11:34:20 | 6.5 | 15     |
  | 2020-07-07 11:24:20 | 3.2 | 5      |

  The reduce transformer has two modes:

  - **Series to rows -** Creates a row for each field and a column for each calculation.
  - **Reduce fields -** Keeps the existing frame structure, but collapses each field into a single value.

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

  Query A:

  | Temp | Uptime  |
  | ---- | ------- |
  | 15.4 | 1230233 |

  Query B:

  | AQI | Errors |
  | --- | ------ |
  | 3.2 | 5      |
  `;
};
