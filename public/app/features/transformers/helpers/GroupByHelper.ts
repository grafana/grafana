export const groupByHelper = () => {
  return `
  Use this transformation to group the data by a specified field (column) value and processes calculations on each group. Click to see a list of calculation choices. For information about available calculations, refer to [Calculation types](https://grafana.com/docs/grafana/latest/panels-visualizations/calculation-types/).

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
  `;
};
