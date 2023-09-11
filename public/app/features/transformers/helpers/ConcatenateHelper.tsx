import React from 'react';

export const ConcatenateHelper = () => {
  return (
    <div>
      <p>This transformation combines all fields from all frames into one result. Consider:</p>
      <p>Query A:</p>
      <table>
        <thead>
          <tr>
            <th>Temp</th>
            <th>Uptime</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>15.4</td>
            <td>1230233</td>
          </tr>
        </tbody>
      </table>
      <p>Query B:</p>
      <table>
        <thead>
          <tr>
            <th>AQI</th>
            <th>Errors</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>3.2</td>
            <td>5</td>
          </tr>
        </tbody>
      </table>
      <p>After you concatenate the fields, the data frame would be:</p>
      <table>
        <thead>
          <tr>
            <th>Temp</th>
            <th>Uptime</th>
            <th>AQI</th>
            <th>Errors</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>15.4</td>
            <td>1230233</td>
            <td>3.2</td>
            <td>5</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
};
