import React from 'react';

export const ConvertFieldTypeHelper = () => {
  return (
    <div>
      <p>This transformation changes the field type of the specified field.</p>
      <ul style={{ paddingLeft: 30 }}>
        <li>
          <strong>Field -</strong> Select from available fields
        </li>
        <li>
          <strong>as -</strong> Select the FieldType to convert to
          <ul style={{ paddingLeft: 30 }}>
            <li>
              <strong>Numeric -</strong> attempts to make the values numbers
            </li>
            <li>
              <strong>String -</strong> will make the values strings
            </li>
            <li>
              <strong>Time -</strong> attempts to parse the values as time
              <ul style={{ paddingLeft: 30 }}>
                <li>
                  Will show an option to specify a DateFormat as input by a string like yyyy-mm-dd or DD MM YYYY
                  hh:mm:ss
                </li>
              </ul>
            </li>
            <li>
              <strong>Boolean -</strong> will make the values booleans
            </li>
          </ul>
        </li>
      </ul>
      <br />
      <p>
        For example the following query could be modified by selecting the time field, as Time, and Date Format as YYYY.
      </p>
      <table>
        <thead>
          <tr>
            <th>Time</th>
            <th style={{ paddingLeft: 30 }}>Mark</th>
            <th style={{ paddingLeft: 30 }}>Value</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>2017-07-01</td>
            <td style={{ paddingLeft: 30 }}>above</td>
            <td style={{ paddingLeft: 30 }}>25</td>
          </tr>
          <tr>
            <td>2018-08-02</td>
            <td style={{ paddingLeft: 30 }}>below</td>
            <td style={{ paddingLeft: 30 }}>22</td>
          </tr>
          <tr>
            <td>2019-09-02</td>
            <td style={{ paddingLeft: 30 }}>below</td>
            <td style={{ paddingLeft: 30 }}>29</td>
          </tr>
          <tr>
            <td>2020-10-04</td>
            <td style={{ paddingLeft: 30 }}>above</td>
            <td style={{ paddingLeft: 30 }}>22</td>
          </tr>
        </tbody>
      </table>
      <br />
      <p>The result:</p>
      <table>
        <thead>
          <tr>
            <th>Time</th>
            <th style={{ paddingLeft: 30 }}>Mark</th>
            <th style={{ paddingLeft: 30 }}>Value</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>2017-01-01 00:00:00</td>
            <td style={{ paddingLeft: 30 }}>above</td>
            <td style={{ paddingLeft: 30 }}>25</td>
          </tr>
          <tr>
            <td>2018-01-01 00:00:00</td>
            <td style={{ paddingLeft: 30 }}>below</td>
            <td style={{ paddingLeft: 30 }}>22</td>
          </tr>
          <tr>
            <td>2019-01-01 00:00:00</td>
            <td style={{ paddingLeft: 30 }}>below</td>
            <td style={{ paddingLeft: 30 }}>29</td>
          </tr>
          <tr>
            <td>2020-01-01 00:00:00</td>
            <td style={{ paddingLeft: 30 }}>above</td>
            <td style={{ paddingLeft: 30 }}>22</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
};
