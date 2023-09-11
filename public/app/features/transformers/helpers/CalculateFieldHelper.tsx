// import { css } from '@emotion/css';
import React from 'react';

// import { GrafanaTheme2 } from '@grafana/data';
// import { useStyles2 } from '@grafana/ui';

export const CalculateFieldHelper = () => {
  return (
    <div>
      Use this transformation to add a new field calculated from two other fields. Each transformation allows you to add
      one new field.
      <br />
      <br />
      {/* <ul className={styles.ulPadding}></ul> */}
      <ul style={{ paddingLeft: 15 }}>
        <li>
          <strong>Mode</strong> - Select a mode.
          {/* <ul className={styles.ulPadding}></ul> */}
          <ul style={{ paddingLeft: 15 }}>
            <li>
              <strong>Reduce row</strong> - Apply selected calculation on each row of selected fields independently.
            </li>
            <li>
              <strong>Binary option</strong> - Apply basic math operation (sum, multiply, etc) on values in a single row
              from two selected fields.
            </li>
            <li>
              <strong>Index</strong> - Will insert a field with the row index.
            </li>
          </ul>
        </li>
      </ul>
    </div>
  );
};

// function getStyles(theme: GrafanaTheme2) {
//   return {
//     ulPadding: css({
//       margin: theme.spacing(1, 0),
//       paddingLeft: theme.spacing(5),
//     }),
//   };
// }
