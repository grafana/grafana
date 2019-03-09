// import React from 'react';
import { storiesOf } from '@storybook/react';
import { Table } from './Table';

import { migratedTestTable, migratedTestStyles, simpleTable } from './examples';
import { ScopedVars, TableData } from '../../types/index';
import { withFullSizeStory } from '../../utils/storybook/withFullSizeStory';

const replaceVariables = (value: any, scopedVars: ScopedVars | undefined) => {
  // if (scopedVars) {
  //   // For testing variables replacement in link
  //   _.each(scopedVars, (val, key) => {
  //     value = value.replace('$' + key, val.value);
  //   });
  // }
  return value;
};

storiesOf('UI - Alpha/Table', module)
  .add('basic', () => {
    return withFullSizeStory(Table, {
      styles: [],
      data: simpleTable,
      replaceVariables,
      showHeader: true,
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
