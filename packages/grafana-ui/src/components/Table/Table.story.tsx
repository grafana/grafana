// import React from 'react';
import { storiesOf } from '@storybook/react';
import { Table } from './Table';
import { getTheme } from '../../themes';

import { migratedTestTable, migratedTestStyles, simpleTable } from './examples';
import { ScopedVars, SeriesData, GrafanaThemeType } from '../../types/index';
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

export function columnIndexToLeter(column: number) {
  const A = 'A'.charCodeAt(0);
  const c1 = Math.floor(column / 26);
  const c2 = column % 26;
  if (c1 > 0) {
    return String.fromCharCode(A + c1 - 1) + String.fromCharCode(A + c2);
  }
  return String.fromCharCode(A + c2);
}

export function makeDummyTable(columnCount: number, rowCount: number): SeriesData {
  return {
    fields: Array.from(new Array(columnCount), (x, i) => {
      return {
        name: columnIndexToLeter(i),
      };
    }),
    rows: Array.from(new Array(rowCount), (x, rowId) => {
      const suffix = (rowId + 1).toString();
      return Array.from(new Array(columnCount), (x, colId) => columnIndexToLeter(colId) + suffix);
    }),
  };
}

storiesOf('Alpha/Table', module)
  .add('Basic Table', () => {
    // NOTE: This example does not seem to survice rotate &
    // Changing fixed headers... but the next one does?
    // perhaps `simpleTable` is static and reused?

    const showHeader = boolean('Show Header', true);
    const fixedHeader = boolean('Fixed Header', true);
    const fixedColumns = number('Fixed Columns', 0, { min: 0, max: 50, step: 1, range: false });
    const rotate = boolean('Rotate', false);

    return withFullSizeStory(Table, {
      styles: [],
      data: simpleTable,
      replaceVariables,
      showHeader,
      fixedHeader,
      fixedColumns,
      rotate,
      theme: getTheme(GrafanaThemeType.Light),
    });
  })
  .add('Variable Size', () => {
    const columnCount = number('Column Count', 15, { min: 2, max: 50, step: 1, range: false });
    const rowCount = number('Row Count', 20, { min: 0, max: 100, step: 1, range: false });

    const showHeader = boolean('Show Header', true);
    const fixedHeader = boolean('Fixed Header', true);
    const fixedColumns = number('Fixed Columns', 1, { min: 0, max: 50, step: 1, range: false });
    const rotate = boolean('Rotate', false);

    return withFullSizeStory(Table, {
      styles: [],
      data: makeDummyTable(columnCount, rowCount),
      replaceVariables,
      showHeader,
      fixedHeader,
      fixedColumns,
      rotate,
      theme: getTheme(GrafanaThemeType.Light),
    });
  })
  .add('Test Config (migrated)', () => {
    return withFullSizeStory(Table, {
      styles: migratedTestStyles,
      data: migratedTestTable,
      replaceVariables,
      showHeader: true,
      rotate: true,
      theme: getTheme(GrafanaThemeType.Light),
    });
  });
