import React from 'react';

export const FieldLookupHelper = () => {
  return (
    <div>
      <p>Use this transformation on a field value to look up additional fields from an external source.</p>
      <ul style={{ paddingLeft: 30 }}>
        <li>
          <strong>Field</strong> - Select a text field.
        </li>
        <li>
          <strong>Lookup</strong> - Select from <strong>Countries</strong>, <strong>USA States</strong>, and{' '}
          <strong>Airports</strong>.
        </li>
      </ul>
      <br />
      <p>This transformation currently supports spatial data.</p>
      <p>For example, if you have this data:</p>
      <table>
        <thead>
          <tr>
            <th>Location</th>
            <th style={{ paddingLeft: 30 }}>Values</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>AL</td>
            <td style={{ paddingLeft: 30 }}>0</td>
          </tr>
          <tr>
            <td>AK</td>
            <td style={{ paddingLeft: 30 }}>10</td>
          </tr>
          <tr>
            <td>Arizona</td>
            <td style={{ paddingLeft: 30 }}>5</td>
          </tr>
          <tr>
            <td>Arkansas</td>
            <td style={{ paddingLeft: 30 }}>1</td>
          </tr>
          <tr>
            <td>Somewhere</td>
            <td style={{ paddingLeft: 30 }}>5</td>
          </tr>
        </tbody>
      </table>
      <br />
      <p>With this configuration:</p>
      <ul style={{ paddingLeft: 30 }}>
        <li>Field: location</li>
        <li>Lookup: USA States</li>
      </ul>
      <br />
      <p>You&apos;ll get the following output:</p>
      <table>
        <thead>
          <tr>
            <th>Location</th>
            <th style={{ paddingLeft: 30 }}>ID</th>
            <th style={{ paddingLeft: 30 }}>Name</th>
            <th style={{ paddingLeft: 30 }}>Lng</th>
            <th style={{ paddingLeft: 30 }}>Lat</th>
            <th style={{ paddingLeft: 30 }}>Values</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>AL</td>
            <td style={{ paddingLeft: 30 }}>AL</td>
            <td style={{ paddingLeft: 30 }}>Alabama</td>
            <td style={{ paddingLeft: 30 }}>-80.891064</td>
            <td style={{ paddingLeft: 30 }}>12.448457</td>
            <td style={{ paddingLeft: 30 }}>0</td>
          </tr>
          <tr>
            <td>AK</td>
            <td style={{ paddingLeft: 30 }}>AK</td>
            <td style={{ paddingLeft: 30 }}>Arkansas</td>
            <td style={{ paddingLeft: 30 }}>-100.891064</td>
            <td style={{ paddingLeft: 30 }}>24.448457</td>
            <td style={{ paddingLeft: 30 }}>10</td>
          </tr>
          <tr>
            <td>Arizona</td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
            <td style={{ paddingLeft: 30 }}>5</td>
          </tr>
          <tr>
            <td>Arkansas</td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
            <td style={{ paddingLeft: 30 }}>1</td>
          </tr>
          <tr>
            <td>Somewhere</td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
            <td style={{ paddingLeft: 30 }}>5</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
};
