import { Property } from 'csstype';
import { clone } from 'lodash';
import memoizeOne from 'memoize-one';
import React from 'react';
import { Row } from 'react-table';

import {
  DataFrame,
  Field,
  FieldType,
  formattedValueToString,
  getFieldDisplayName,
  SelectableValue,
  fieldReducers,
  getDisplayProcessor,
  reduceField,
  GrafanaTheme2,
  ArrayVector,
} from '@grafana/data';

import { BarGaugeCell } from './BarGaugeCell';
import { DefaultCell } from './DefaultCell';
import { getFooterValue } from './FooterRow';
import { GeoCell } from './GeoCell';
import { ImageCell } from './ImageCell';
import { JSONViewCell } from './JSONViewCell';
import { RowExpander } from './RowExpander';
import {
  CellComponent,
  TableCellDisplayMode,
  TableFieldOptions,
  FooterItem,
  GrafanaTableColumn,
  TableFooterCalc,
} from './types';

export const EXPANDER_WIDTH = 50;

export function getTextAlign(field?: Field): Property.JustifyContent {
  if (!field) {
    return 'flex-start';
  }

  if (field.config.custom) {
    const custom = field.config.custom as TableFieldOptions;

    switch (custom.align) {
      case 'right':
        return 'flex-end';
      case 'left':
        return 'flex-start';
      case 'center':
        return 'center';
    }
  }

  if (field.type === FieldType.number) {
    return 'flex-end';
  }

  return 'flex-start';
}

export function getColumns(
  data: DataFrame,
  availableWidth: number,
  columnMinWidth: number,
  expandedIndexes: Set<number>,
  setExpandedIndexes: (indexes: Set<number>) => void,
  expander: boolean,
  footerValues?: FooterItem[]
): GrafanaTableColumn[] {
  const columns: GrafanaTableColumn[] = expander
    ? [
        {
          // Make an expander cell
          Header: () => null, // No header
          id: 'expander', // It needs an ID
          Cell: ({ row }) => {
            return <RowExpander row={row} expandedIndexes={expandedIndexes} setExpandedIndexes={setExpandedIndexes} />;
          },
          width: EXPANDER_WIDTH,
          minWidth: EXPANDER_WIDTH,
          filter: (rows: Row[], id: string, filterValues?: SelectableValue[]) => {
            return [];
          },
          justifyContent: 'left',
          field: data.fields[0],
          sortType: 'basic',
        },
      ]
    : [];
  let fieldCountWithoutWidth = 0;

  if (expander) {
    availableWidth -= EXPANDER_WIDTH;
  }

  for (const [fieldIndex, field] of data.fields.entries()) {
    const fieldTableOptions = (field.config.custom || {}) as TableFieldOptions;

    if (fieldTableOptions.hidden) {
      continue;
    }

    if (fieldTableOptions.width) {
      availableWidth -= fieldTableOptions.width;
    } else {
      fieldCountWithoutWidth++;
    }

    const selectSortType = (type: FieldType) => {
      switch (type) {
        case FieldType.number:
          return 'number';
        case FieldType.time:
          return 'basic';
        default:
          return 'alphanumeric-insensitive';
      }
    };

    const Cell = getCellComponent(fieldTableOptions.displayMode, field);
    columns.push({
      Cell,
      id: fieldIndex.toString(),
      field: field,
      Header: getFieldDisplayName(field, data),
      accessor: (row: any, i: number) => {
        return field.values.get(i);
      },
      sortType: selectSortType(field.type),
      width: fieldTableOptions.width,
      minWidth: fieldTableOptions.minWidth ?? columnMinWidth,
      filter: memoizeOne(filterByValue(field)),
      justifyContent: getTextAlign(field),
      Footer: getFooterValue(fieldIndex, footerValues),
    });
  }

  // set columns that are at minimum width
  let sharedWidth = availableWidth / fieldCountWithoutWidth;
  for (let i = fieldCountWithoutWidth; i > 0; i--) {
    for (const column of columns) {
      if (!column.width && column.minWidth > sharedWidth) {
        column.width = column.minWidth;
        availableWidth -= column.width;
        fieldCountWithoutWidth -= 1;
        sharedWidth = availableWidth / fieldCountWithoutWidth;
      }
    }
  }

  // divide up the rest of the space
  for (const column of columns) {
    if (!column.width) {
      column.width = sharedWidth;
    }
    column.minWidth = 50;
  }

  return columns;
}

export function getCellComponent(displayMode: TableCellDisplayMode, field: Field): CellComponent {
  switch (displayMode) {
    case TableCellDisplayMode.ColorText:
    case TableCellDisplayMode.ColorBackground:
      return DefaultCell;
    case TableCellDisplayMode.Image:
      return ImageCell;
    case TableCellDisplayMode.LcdGauge:
    case TableCellDisplayMode.BasicGauge:
    case TableCellDisplayMode.GradientGauge:
      return BarGaugeCell;
    case TableCellDisplayMode.JSONView:
      return JSONViewCell;
  }

  if (field.type === FieldType.geo) {
    return GeoCell;
  }

  // Default or Auto
  if (field.type === FieldType.other) {
    return JSONViewCell;
  }
  return DefaultCell;
}

export function filterByValue(field?: Field) {
  return function (rows: Row[], id: string, filterValues?: SelectableValue[]) {
    if (rows.length === 0) {
      return rows;
    }

    if (!filterValues) {
      return rows;
    }

    if (!field) {
      return rows;
    }

    return rows.filter((row) => {
      if (!row.values.hasOwnProperty(id)) {
        return false;
      }
      const value = rowToFieldValue(row, field);
      return filterValues.find((filter) => filter.value === value) !== undefined;
    });
  };
}

export function calculateUniqueFieldValues(rows: any[], field?: Field) {
  if (!field || rows.length === 0) {
    return {};
  }

  const set: Record<string, string> = {};

  for (let index = 0; index < rows.length; index++) {
    const value = rowToFieldValue(rows[index], field);
    set[value || '(Blanks)'] = value;
  }

  return set;
}

export function rowToFieldValue(row: any, field?: Field): string {
  if (!field || !row) {
    return '';
  }

  const fieldValue = field.values.get(row.index);
  const displayValue = field.display ? field.display(fieldValue) : fieldValue;
  const value = field.display ? formattedValueToString(displayValue) : displayValue;

  return value;
}

export function valuesToOptions(unique: Record<string, any>): SelectableValue[] {
  return Object.keys(unique)
    .reduce((all, key) => all.concat({ value: unique[key], label: key }), [] as SelectableValue[])
    .sort(sortOptions);
}

export function sortOptions(a: SelectableValue, b: SelectableValue): number {
  if (a.label === undefined && b.label === undefined) {
    return 0;
  }

  if (a.label === undefined && b.label !== undefined) {
    return -1;
  }

  if (a.label !== undefined && b.label === undefined) {
    return 1;
  }

  if (a.label! < b.label!) {
    return -1;
  }

  if (a.label! > b.label!) {
    return 1;
  }

  return 0;
}

export function getFilteredOptions(options: SelectableValue[], filterValues?: SelectableValue[]): SelectableValue[] {
  if (!filterValues) {
    return [];
  }

  return options.filter((option) => filterValues.some((filtered) => filtered.value === option.value));
}

export function sortCaseInsensitive(a: Row<any>, b: Row<any>, id: string) {
  return String(a.values[id]).localeCompare(String(b.values[id]), undefined, { sensitivity: 'base' });
}

// sortNumber needs to have great performance as it is called a lot
export function sortNumber(rowA: Row<any>, rowB: Row<any>, id: string) {
  const a = toNumber(rowA.values[id]);
  const b = toNumber(rowB.values[id]);
  return a === b ? 0 : a > b ? 1 : -1;
}

function toNumber(value: any): number {
  if (value === null || value === undefined || value === '' || isNaN(value)) {
    return Number.NEGATIVE_INFINITY;
  }

  if (typeof value === 'number') {
    return value;
  }

  return Number(value);
}

export function getFooterItems(
  filterFields: Array<{ field: Field }>,
  values: any[number],
  options: TableFooterCalc,
  theme2: GrafanaTheme2
): FooterItem[] {
  return filterFields.map((data, i) => {
    if (data.field.type !== FieldType.number) {
      // show the reducer in the first column
      if (i === 0 && options.reducer && options.reducer.length > 0) {
        const reducer = fieldReducers.get(options.reducer[0]);
        return reducer.name;
      }
      return undefined;
    }
    let newField = clone(data.field);
    newField.values = new ArrayVector(values[i]);
    newField.state = undefined;

    data.field = newField;
    if (options.fields && options.fields.length > 0) {
      const f = options.fields.find((f) => f === data.field.name);
      if (f) {
        return getFormattedValue(data.field, options.reducer, theme2);
      }
      return undefined;
    }
    return getFormattedValue(data.field, options.reducer || [], theme2);
  });
}

function getFormattedValue(field: Field, reducer: string[], theme: GrafanaTheme2) {
  const fmt = field.display ?? getDisplayProcessor({ field, theme });
  const calc = reducer[0];
  const v = reduceField({ field, reducers: reducer })[calc];
  return formattedValueToString(fmt(v));
}

export function createFooterCalculationValues(rows: Row[]): any[number] {
  const values: any[number] = [];

  for (const key in rows) {
    for (const [valKey, val] of Object.entries(rows[key].values)) {
      if (values[valKey] === undefined) {
        values[valKey] = [];
      }
      values[valKey].push(val);
    }
  }

  return values;
}
