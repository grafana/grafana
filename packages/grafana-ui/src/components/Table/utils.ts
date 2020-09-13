import { Column, Row } from 'react-table';
import memoizeOne from 'memoize-one';
import { css, cx } from 'emotion';
import tinycolor from 'tinycolor2';
import { ContentPosition, TextAlignProperty } from 'csstype';
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
import { TableCellDisplayMode, TableCellProps, TableFieldOptions } from './types';
import { withTableStyles } from './withTableStyles';
import { JSONViewCell } from './JSONViewCell';

export function getTextAlign(field?: Field): TextAlignProperty {
  if (!field) {
    return 'left';
  }

  if (field.config.custom) {
    const custom = field.config.custom as TableFieldOptions;

    switch (custom.align) {
      case 'right':
        return 'right';
      case 'left':
        return 'left';
      case 'center':
        return 'center';
    }
  }

  if (field.type === FieldType.number) {
    return 'right';
  }

  return 'left';
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
      filter: memoizeOne(filterByValue),
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
      return withTableStyles(DefaultCell, getTextColorStyle);
    case TableCellDisplayMode.ColorBackground:
      return withTableStyles(DefaultCell, getBackgroundColorStyle);
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

function getTextColorStyle(props: TableCellProps) {
  const { field, cell, tableStyles } = props;

  if (!field.display) {
    return tableStyles;
  }

  const displayValue = field.display(cell.value);
  if (!displayValue.color) {
    return tableStyles;
  }

  const extendedStyle = css`
    color: ${displayValue.color};
  `;

  return {
    ...tableStyles,
    tableCell: cx(tableStyles.tableCell, extendedStyle),
  };
}

function getBackgroundColorStyle(props: TableCellProps) {
  const { field, cell, tableStyles } = props;
  if (!field.display) {
    return tableStyles;
  }

  const displayValue = field.display(cell.value);
  if (!displayValue.color) {
    return tableStyles;
  }

  const themeFactor = tableStyles.theme.isDark ? 1 : -0.7;
  const bgColor2 = tinycolor(displayValue.color)
    .darken(10 * themeFactor)
    .spin(5)
    .toRgbString();

  const extendedStyle = css`
    background: linear-gradient(120deg, ${bgColor2}, ${displayValue.color});
    color: white;
    height: ${tableStyles.cellHeight}px;
    padding: ${tableStyles.cellPadding}px;
  `;

  return {
    ...tableStyles,
    tableCell: cx(tableStyles.tableCell, extendedStyle),
  };
}

export function filterByValue(rows: Row[], id: string, filterValues?: SelectableValue[]) {
  if (rows.length === 0) {
    return rows;
  }

  if (!filterValues) {
    return rows;
  }

  return rows.filter(row => {
    if (!row.values.hasOwnProperty(id)) {
      return false;
    }

    const value = row.values[id];
    return filterValues.find(filter => filter.value === value) !== undefined;
  });
}

export function getHeaderAlign(field?: Field): ContentPosition {
  const align = getTextAlign(field);

  if (align === 'right') {
    return 'flex-end';
  }

  if (align === 'center') {
    return align;
  }

  return 'flex-start';
}

export function calculateUniqueFieldValues(rows: any[], field?: Field) {
  if (!field || rows.length === 0) {
    return {};
  }

  const set: Record<string, any> = {};

  for (let index = 0; index < rows.length; index++) {
    const fieldIndex = parseInt(rows[index].id, 10);
    const fieldValue = field.values.get(fieldIndex);
    const displayValue = field.display ? field.display(fieldValue) : fieldValue;
    const value = field.display ? formattedValueToString(displayValue) : displayValue;
    set[value || '(Blanks)'] = fieldValue;
  }

  return set;
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
