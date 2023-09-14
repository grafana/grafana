import { getLinkToDocs } from './getLinkToDocs';

export const seriesToRowsHelper = () => {
  return `
  Use this transformation to combine the result from multiple time series data queries into one single result. This is helpful when using the table panel visualization.

  The result from this transformation will contain three columns: Time, Metric, and Value. The Metric column is added so you easily can see from which query the metric originates from. Customize this value by defining Label on the source query.

  In the example below, we have two queries returning time series data. It is visualized as two separate tables before applying the transformation.

  Query A:

  | Time                | Temperature |
  | ------------------- | ----------- |
  | 2020-07-07 11:34:20 | 25          |
  | 2020-07-07 10:31:22 | 22          |
  | 2020-07-07 09:30:05 | 19          |

  Query B:

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

  > **Note:** This transformation is available in Grafana 7.1+.
  ${getLinkToDocs()}
  `;
};
