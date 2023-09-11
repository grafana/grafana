import React from 'react';

// JEV: esc `'` with `&apos;`?

export const ExtractFieldsHelper = () => {
  return (
    <div>
      <p>
        Use this transformation to select one source of data and extract content from it in different formats. Set the
        following fields:
      </p>
      <ul style={{ paddingLeft: 30 }}>
        <li>
          <strong>Source</strong> - Select the field for the source of data.
        </li>
        <li>
          <strong>Format</strong> - Select one of the following:
          <ul style={{ paddingLeft: 30 }}>
            <li>
              <strong>JSON</strong> - To parse JSON content from the source.
            </li>
            <li>
              <strong>Key+value parse</strong> - To parse content in the format <code>a=b</code> or <code>c:d</code>{' '}
              from the source.
            </li>
            <li>
              <strong>Auto</strong> - To discover fields automatically.
            </li>
          </ul>
        </li>
        <li>
          <strong>Replace all fields</strong> - Optional: Select this option if you want to hide all other fields and
          display only your calculated field in the visualization.
        </li>
        <li>
          <strong>Keep time</strong> - Optional: Only available if <strong>Replace all fields</strong> is true. Keep the
          time field in the output.
        </li>
      </ul>
      <br />
      <p>Consider the following data set:</p>
      <table>
        <thead>
          <tr>
            <th>Timestamp</th>
            <th style={{ paddingLeft: 30 }}>json_data</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>1636678740000000000</td>
            <td style={{ paddingLeft: 30 }}>{JSON.stringify({ value: 1 })}</td>
          </tr>
          <tr>
            <td>1636678680000000000</td>
            <td style={{ paddingLeft: 30 }}>{JSON.stringify({ value: 5 })}</td>
          </tr>
          <tr>
            <td>1636678620000000000</td>
            <td style={{ paddingLeft: 30 }}>{JSON.stringify({ value: 12 })}</td>
          </tr>
        </tbody>
      </table>
      <br />
      <p>
        You could prepare the data to be used by a{' '}
        <a href="/docs/grafana/latest/panels-visualizations/visualizations/time-series/">Time series panel</a> with this
        configuration:
      </p>
      <ul style={{ paddingLeft: 30 }}>
        <li>Source: json_data</li>
        <li>
          Format: JSON
          <ul style={{ paddingLeft: 30 }}>
            <li>Field: value</li>
            <li>alias: my_value</li>
          </ul>
        </li>
        <li>Replace all fields: true</li>
        <li>Keep time: true</li>
      </ul>
      <br />
      <p>This will generate the following output:</p>
      <table>
        <thead>
          <tr>
            <th>Timestamp</th>
            <th style={{ paddingLeft: 30 }}>my_value</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>1636678740000000000</td>
            <td style={{ paddingLeft: 30 }}>1</td>
          </tr>
          <tr>
            <td>1636678680000000000</td>
            <td style={{ paddingLeft: 30 }}>5</td>
          </tr>
          <tr>
            <td>1636678620000000000</td>
            <td style={{ paddingLeft: 30 }}>12</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
};
