import { Column, Row } from 'react-table';
import memoizeOne from 'memoize-one';
import { ContentPosition } from 'csstype';
import {
  DataFrame,
  Field,
  FieldType,
  formattedValueToString,
  getFieldDisplayName,
  SelectableValue,
} from '@grafana/data';

import { DefaultCell } from './DefaultCell';
import { BarGaugeCell } from './BarGaugeCell';
import { TableCellDisplayMode, TableFieldOptions } from './types';
import { JSONViewCell } from './JSONViewCell';
import { ImageCell } from './ImageCell';

export function getTextAlign(field?: Field): ContentPosition {
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

export function getColumns(data: DataFrame, availableWidth: number, columnMinWidth: number): Column[] {
  const columns: any[] = [];
  let fieldCountWithoutWidth = data.fields.length;

  for (const [fieldIndex, field] of data.fields.entries()) {
    const fieldTableOptions = (field.config.custom || {}) as TableFieldOptions;

    if (fieldTableOptions.hidden) {
      continue;
    }

    if (fieldTableOptions.width) {
      availableWidth -= fieldTableOptions.width;
      fieldCountWithoutWidth -= 1;
    }

    const selectSortType = (type: FieldType): string => {
      switch (type) {
        case FieldType.number:
        case FieldType.time:
          return 'basic';
        default:
          return 'alphanumeric';
      }
    };

    const Cell = getCellComponent(fieldTableOptions.displayMode, field);
    columns.push({
      Cell,
      id: fieldIndex.toString(),
      Header: getFieldDisplayName(field, data),
      accessor: (row: any, i: number) => {
        return field.values.get(i);
      },
      sortType: selectSortType(field.type),
      width: fieldTableOptions.width,
      minWidth: 50,
      filter: memoizeOne(filterByValue(field)),
      justifyContent: getTextAlign(field),
    });
  }

  // divide up the rest of the space
  const sharedWidth = availableWidth / fieldCountWithoutWidth;
  for (const column of columns) {
    if (!column.width) {
      column.width = Math.max(sharedWidth, columnMinWidth);
    }
  }

  return columns;
}

function getCellComponent(displayMode: TableCellDisplayMode, field: Field) {
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

  // Default or Auto
  if (field.type === FieldType.other) {
    return JSONViewCell;
  }
  return DefaultCell;
}

export function filterByValue(field?: Field) {
  return function(rows: Row[], id: string, filterValues?: SelectableValue[]) {
    if (rows.length === 0) {
      return rows;
    }

    if (!filterValues) {
      return rows;
    }

    if (!field) {
      return rows;
    }

    return rows.filter(row => {
      if (!row.values.hasOwnProperty(id)) {
        return false;
      }
      const value = rowToFieldValue(row, field);
      return filterValues.find(filter => filter.value === value) !== undefined;
    });
  };
}

export function calculateUniqueFieldValues(rows: any[], field?: Field) {
  if (!field || rows.length === 0) {
    return {};
  }

  const set: Record<string, any> = {};

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

  return options.filter(option => filterValues.some(filtered => filtered.value === option.value));
}
