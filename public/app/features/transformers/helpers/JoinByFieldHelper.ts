export const JoinByFieldHelper = () => {
  return `
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
  `;
};
