export const LimitHelper = () => {
  return `
  Use this transformation to limit the number of rows displayed.

  In the example below, we have the following response from the data source:

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
  `;
};
