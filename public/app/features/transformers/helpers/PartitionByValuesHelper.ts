export const partitionByValuesHelper = () => {
  return `
  This transformation can help eliminate the need for multiple queries to the same datasource with different 'WHERE' clauses when graphing multiple series. Consider a metrics SQL table with the following data:

  | Time                | Region | Value |
  | ------------------- | ------ | ----- |
  | 2022-10-20 12:00:00 | US     | 1520  |
  | 2022-10-20 12:00:00 | EU     | 2936  |
  | 2022-10-20 01:00:00 | US     | 1327  |
  | 2022-10-20 01:00:00 | EU     | 912   |

  Prior to v9.3, if you wanted to plot a red trendline for US and a blue one for EU in the same TimeSeries panel, you would likely have to split this into two queries:

  'SELECT Time, Value FROM metrics WHERE Time > "2022-10-20" AND Region="US"'<br>
  'SELECT Time, Value FROM metrics WHERE Time > "2022-10-20" AND Region="EU"'

  This also requires you to know ahead of time which regions actually exist in the metrics table.

  With the _Partition by values_ transformer, you can now issue a single query and split the results by unique values in one or more columns ('fields') of your choosing. The following example uses 'Region'.

  'SELECT Time, Region, Value FROM metrics WHERE Time > "2022-10-20"'

  | Time                | Region | Value |
  | ------------------- | ------ | ----- |
  | 2022-10-20 12:00:00 | US     | 1520  |
  | 2022-10-20 01:00:00 | US     | 1327  |

  | Time                | Region | Value |
  | ------------------- | ------ | ----- |
  | 2022-10-20 12:00:00 | EU     | 2936  |
  | 2022-10-20 01:00:00 | EU     | 912   |
  `;
};
