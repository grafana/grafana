// import React from 'react';
import { storiesOf } from '@storybook/react';
import { Table } from './Table';

import { migratedTestTable, migratedTestStyles, simpleTable } from './examples';
import { ScopedVars, TableData } from '../../types/index';
import { withFullSizeStory } from '../../utils/storybook/withFullSizeStory';
import { number, boolean } from '@storybook/addon-knobs';

const replaceVariables = (value: string, scopedVars?: ScopedVars) => {
  if (scopedVars) {
    // For testing variables replacement in link
    for (const key in scopedVars) {
      const val = scopedVars[key];
      value = value.replace('$' + key, val.value);
    }
  }
  return value;
};

export function makeDummyTable(columnCount: number, rowCount: number): TableData {
  const A = 'A'.charCodeAt(0);
  return {
    columns: Array.from(new Array(columnCount), (x, i) => {
      return {
        text: String.fromCharCode(A + i),
      };
    }),
    rows: Array.from(new Array(rowCount), (x, rowId) => {
      const suffix = (rowId + 1).toString();
      return Array.from(new Array(columnCount), (x, colId) => String.fromCharCode(A + colId) + suffix);
    }),
    type: 'table',
    columnMap: {},
  };
}

storiesOf('Alpha/Table', module)
  .add('basic', () => {
    const showHeader = boolean('Show Header', true);
    const fixedRowCount = number('Fixed Rows', 1, { min: 0, max: 50, step: 1, range: false });
    const fixedColumnCount = number('Fixed Columns', 1, { min: 0, max: 50, step: 1, range: false });

    return withFullSizeStory(Table, {
      styles: [],
      data: simpleTable,
      replaceVariables,
      fixedRowCount,
      fixedColumnCount,
      showHeader,
    });
  })
  .add('variable size', () => {
    const columnCount = number('Column Count', 10, { min: 2, max: 50, step: 1, range: false });
    const rowCount = number('Row Count', 20, { min: 0, max: 100, step: 1, range: false });

    const showHeader = boolean('Show Header', true);
    const fixedRowCount = number('Fixed Rows', 1, { min: 0, max: 50, step: 1, range: false });
    const fixedColumnCount = number('Fixed Columns', 1, { min: 0, max: 50, step: 1, range: false });

    return withFullSizeStory(Table, {
      styles: [],
      data: makeDummyTable(columnCount, rowCount),
      replaceVariables,
      fixedRowCount,
      fixedColumnCount,
      showHeader,
    });
  })
  .add('Old tests configuration', () => {
    return withFullSizeStory(Table, {
      styles: migratedTestStyles,
      data: migratedTestTable,
      replaceVariables,
      showHeader: true,
    });
  });
