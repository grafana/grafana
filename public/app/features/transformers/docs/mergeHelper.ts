export const mergeHelper = () => {
  return `
  Use this transformation to combine the result from multiple queries into one single result. This is helpful when using the table panel visualization. Values that can be merged are combined into the same row. Values are mergeable if the shared fields contain the same data. For information, refer to [Table panel]({{< relref "../../visualizations/table/" >}}).

  In the example below, we have two queries returning table data. It is visualized as two separate tables before applying the transformation.

  Query A:

  | Time                | Job     | Uptime    |
  | ------------------- | ------- | --------- |
  | 2020-07-07 11:34:20 | node    | 25260122  |
  | 2020-07-07 11:24:20 | postgre | 123001233 |

  Query B:

  | Time                | Job     | Errors |
  | ------------------- | ------- | ------ |
  | 2020-07-07 11:34:20 | node    | 15     |
  | 2020-07-07 11:24:20 | postgre | 5      |

  Here is the result after applying the Merge transformation.

  | Time                | Job     | Errors | Uptime    |
  | ------------------- | ------- | ------ | --------- |
  | 2020-07-07 11:34:20 | node    | 15     | 25260122  |
  | 2020-07-07 11:24:20 | postgre | 5      | 123001233 |
  `;
};
