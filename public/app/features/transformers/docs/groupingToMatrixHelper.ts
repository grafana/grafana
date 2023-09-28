export const groupingToMatrixHelper = () => {
  return `
  Use this transformation to combine three fields-that will be used as input for the **Column**, **Row**, and **Cell value** fields-from the query output, and generate a matrix. This matrix will be calculated as follows:

  **Original data**

  | Server ID | CPU Temperature | Server Status |
  | --------- | --------------- | ------------- |
  | server 1  | 82              | OK            |
  | server 2  | 88.6            | OK            |
  | server 3  | 59.6            | Shutdown      |

  We can generate a matrix using the values of 'Server Status' as column names, the 'Server ID' values as row names, and the 'CPU Temperature' as content of each cell. The content of each cell will appear for the existing column ('Server Status') and row combination ('Server ID'). For the rest of the cells, you can select which value to display between: **Null**, **True**, **False**, or **Empty**.

  **Output**

  | Server ID\Server Status | OK   | Shutdown |
  | ----------------------- | ---- | -------- |
  | server 1                | 82   |          |
  | server 2                | 88.6 |          |
  | server 3                |      | 59.6     |
  `;
};
