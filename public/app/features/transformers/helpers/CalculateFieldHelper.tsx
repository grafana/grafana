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
          <strong>Mode -</strong> Select a mode:
          <ul style={{ paddingLeft: 15 }}>
            <li>
              <strong>Reduce row -</strong> Apply selected calculation on each row of selected fields independently.
            </li>
            <li>
              <strong>Binary option -</strong> Apply basic math operation(sum, multiply, etc) on values in a single row
              from two selected fields.
            </li>
            <li>
              <strong>Index -</strong> Will insert a field with the row index.
            </li>
          </ul>
        </li>
        <li>
          <strong>Field name -</strong> Select the names of fields you want to use in the calculation for the new field.
        </li>
        <li>
          <strong>Calculation -</strong> If you select <strong>Reduce row</strong> mode, then the{' '}
          <strong>Calculation</strong> field appears. Click in the field to see a list of calculation choices you can
          use to create the new field. For information about available calculations, refer to{' '}
          <a href="/docs/grafana/latest/panels-visualizations/calculation-types/">Calculation types</a>.
        </li>
        <li>
          <strong>Operation -</strong> If you select <strong>Binary option</strong> mode, then the{' '}
          <strong>Operation</strong> fields appear. These fields allow you to do basic math operations on values in a
          single row from two selected fields. You can also use numerical values for binary operations.
        </li>
        <li>
          <strong>Alias -</strong> (Optional) Enter the name of your new field. If you leave this blank, then the field
          will be named to match the calculation.
        </li>
        <li>
          <strong>Replace all fields -</strong> (Optional) Select this option if you want to hide all other fields and
          display only your calculated field in the visualization.
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
