export const filterByValueHelper = () => {
  return `
  Use this transformation to filter your data directly in Grafana and remove some data points from your query result. You have the option to include or exclude data that match one or more conditions you define. The conditions are applied on a selected field.
  
  This transformation is very useful if your data source does not natively filter by values. You might also use this to narrow values to display if you are using a shared query.
  
  The available conditions for all fields are:
  
  - **Regex:** Match a regex expression
  - **Is Null:** Match if the value is null
  - **Is Not Null:** Match if the value is not null
  - **Equal:** Match if the value is equal to the specified value
  - **Different:** Match if the value is different than the specified value
  
  The available conditions for number fields are:
  
  - **Greater:** Match if the value is greater than the specified value
  - **Lower:** Match if the value is lower than the specified value
  - **Greater or equal:** Match if the value is greater or equal
  - **Lower or equal:** Match if the value is lower or equal
  - **Range:** Match a range between a specified minimum and maximum, min and max included
  
  Consider the following data set:
  
  ## Data Set Example
  
  | Time                | Temperature | Altitude |
  |---------------------|-------------|----------|
  | 2020-07-07 11:34:23 | 32          | 101      |
  | 2020-07-07 11:34:22 | 28          | 125      |
  | 2020-07-07 11:34:21 | 26          | 110      |
  | 2020-07-07 11:34:20 | 23          | 98       |
  | 2020-07-07 10:32:24 | 31          | 95       |
  | 2020-07-07 10:31:22 | 20          | 85       |
  | 2020-07-07 09:30:57 | 19          | 101      |
  
  If you **Include** the data points that have a temperature below 30°C, the configuration will look as follows:
  
  - Filter Type: 'Include'
  - Condition: Rows where 'Temperature' matches 'Lower Than' '30'
  
  And you will get the following result, where only the temperatures below 30°C are included:
  
  ## Transformed Data
  
  | Time                | Temperature | Altitude |
  |---------------------|-------------|----------|
  | 2020-07-07 11:34:22 | 28          | 125      |
  | 2020-07-07 11:34:21 | 26          | 110      |
  | 2020-07-07 11:34:20 | 23          | 98       |
  | 2020-07-07 10:31:22 | 20          | 85       |
  | 2020-07-07 09:30:57 | 19          | 101      |
  
  You can add more than one condition to the filter. For example, you might want to include the data only if the altitude is greater than 100. To do so, add that condition to the following configuration:
  
  - Filter type: 'Include' rows that 'Match All' conditions
  - Condition 1: Rows where 'Temperature' matches 'Lower' than '30'
  - Condition 2: Rows where 'Altitude' matches 'Greater' than '100'
  
  When you have more than one condition, you can choose if you want the action (include / exclude) to be applied on rows that **Match all** conditions or **Match any** of the conditions you added.
  
  In the example above, we chose **Match all** because we wanted to include the rows that have a temperature lower than 30°C *AND* an altitude higher than 100. If we wanted to include the rows that have a temperature lower than 30°C *OR* an altitude higher than 100 instead, then we would select **Match any**. This would include the first row in the original data, which has a temperature of 32°C (does not match the first condition) but an altitude of 101 (which matches the second condition), so it is included.
  
  Conditions that are invalid or incompletely configured are ignored.
  `;
};
