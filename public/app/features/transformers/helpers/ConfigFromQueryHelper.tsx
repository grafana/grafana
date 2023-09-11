import React from 'react';

const ulPadding = { paddingLeft: 15 };
const tablePadding = { paddingLeft: 30 };

export const ConfigFromQueryHelper = () => {
  return (
    <div>
      <h3>Use cases</h3>
      <p>
        This transformation allows you to select one query and extract standard options such as <strong>Min</strong>,{' '}
        <strong>Max</strong>, <strong>Unit</strong>, and <strong>Thresholds</strong> and apply them to other query
        results. This enables dynamic query-driven visualization configuration.
      </p>
      <h3>Options</h3>
      <ul style={ulPadding}>
        <li>
          <strong>Config query:</strong> Select the query that returns the data you want to use as configuration.
        </li>
        <li>
          <strong>Apply to:</strong> Select what fields or series to apply the configuration to.
        </li>
        <li>
          <strong>Apply to options:</strong> Usually a field type or field name regex depending on what option you
          selected in <strong>Apply to</strong>.
        </li>
      </ul>
      <br />
      <h3>Field mapping table</h3>
      <p>
        Below the configuration listed above, you will find the field table. Here all fields found in the data returned
        by the config query will be listed along with a <strong>Use as</strong> and <strong>Select</strong> option. This
        table gives you control over what field should be mapped to which config property and if there are multiple
        rows, which value to select.
      </p>
      <h2>Example</h2>
      <p>Input[0] (From query: A, name: ServerA)</p>
      <table>
        <thead>
          <tr>
            <th>Time</th>
            <th style={tablePadding}>Value</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>1626178119127</td>
            <td style={tablePadding}>10</td>
          </tr>
          <tr>
            <td>1626178119129</td>
            <td style={tablePadding}>30</td>
          </tr>
        </tbody>
      </table>
      <br />
      <p>Input[1] (From query: B)</p>
      <table>
        <thead>
          <tr>
            <th>Time</th>
            <th style={tablePadding}>Value</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>1626178119127</td>
            <td style={tablePadding}>100</td>
          </tr>
          <tr>
            <td>1626178119129</td>
            <td style={tablePadding}>100</td>
          </tr>
        </tbody>
      </table>
      <br />
      <p>Output (Same as Input[0] but now with config on the Value field)</p>
      <table>
        <thead>
          <tr>
            <th>Time</th>
            <th style={tablePadding}>Value (config: Max=100)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>1626178119127</td>
            <td style={tablePadding}>10</td>
          </tr>
          <tr>
            <td>1626178119129</td>
            <td style={tablePadding}>30</td>
          </tr>
        </tbody>
      </table>
      <br />
      <p>
        Each row in the source data becomes a separate field. Each field now also has a maximum configuration option
        set. Options such as <strong>min</strong>, <strong>max</strong>, <strong>unit</strong>, and{' '}
        <strong>thresholds</strong> are all part of field configuration, and if they are set like this, they will be
        used by the visualization instead of any options that are manually configured in the panel editor options pane.
      </p>
      <h3>Value mappings</h3>
      <p>
        You can also transform a query result into value mappings. This is a bit different because every row in the
        configuration query result is used to define a single value mapping row. See the following example.
      </p>
      <p>Config query result:</p>
      <table>
        <thead>
          <tr>
            <th>Value</th>
            <th style={tablePadding}>Text</th>
            <th style={tablePadding}>Color</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>L</td>
            <td style={tablePadding}>Low</td>
            <td style={tablePadding}>blue</td>
          </tr>
          <tr>
            <td>M</td>
            <td style={tablePadding}>Medium</td>
            <td style={tablePadding}>green</td>
          </tr>
          <tr>
            <td>H</td>
            <td style={tablePadding}>High</td>
            <td style={tablePadding}>red</td>
          </tr>
        </tbody>
      </table>
      <br />
      <p>In the field mapping specify:</p>
      <table>
        <thead>
          <tr>
            <th>Field</th>
            <th style={tablePadding}>Use as</th>
            <th style={tablePadding}>Select</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Value</td>
            <td style={tablePadding}>Value mappings / Value</td>
            <td style={tablePadding}>All values</td>
          </tr>
          <tr>
            <td>Text</td>
            <td style={tablePadding}>Value mappings / Text</td>
            <td style={tablePadding}>All values</td>
          </tr>
          <tr>
            <td>Color</td>
            <td style={tablePadding}>Value mappings / Color</td>
            <td style={tablePadding}>All values</td>
          </tr>
        </tbody>
      </table>
      <br />
      <p>
        Grafana will build the value mappings from your query result and apply it to the real data query results. You
        should see values being mapped and colored according to the config query results.
      </p>
    </div>
  );
};
