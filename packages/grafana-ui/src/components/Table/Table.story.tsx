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

storiesOf('UI/Table', module)
  .add('basic', () => {
    const showHeader = boolean('Show Header', true);
    const fixedRowCount = number('Fixed Rows', 1);
    const fixedColumnCount = number('Fixed Columns', 1);

    return withFullSizeStory(Table, {
      styles: [],
      data: simpleTable,
      replaceVariables,
      fixedRowCount,
      fixedColumnCount,
      showHeader,
    });
  })
  .add('Test Configuration', () => {
    return withFullSizeStory(Table, {
      styles: migratedTestStyles,
      data: migratedTestTable,
      replaceVariables,
      showHeader: true,
    });
  })
  .add('Lots of cells', () => {
    const data = {
      columns: [],
      rows: [],
      type: 'table',
      columnMap: {},
    } as TableData;
    for (let i = 0; i < 20; i++) {
      data.columns.push({
        text: 'Column ' + i,
      });
    }
    for (let r = 0; r < 500; r++) {
      const row = [];
      for (let i = 0; i < 20; i++) {
        row.push(r + i);
      }
      data.rows.push(row);
    }
    console.log('DATA:', data);

    return withFullSizeStory(Table, {
      styles: simpleTable,
      data,
      replaceVariables,
      showHeader: true,
      fixedColumnCount: 1,
      fixedRowCount: 1,
    });
  });
