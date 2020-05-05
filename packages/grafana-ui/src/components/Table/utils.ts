import { TextAlignProperty } from 'csstype';
import { DataFrame, Field, FieldType } from '@grafana/data';
import { Column } from 'react-table';
import { DefaultCell } from './DefaultCell';
import { BarGaugeCell } from './BarGaugeCell';
import { TableCellDisplayMode, TableCellProps, TableFieldOptions } from './types';
import { css, cx } from 'emotion';
import { withTableStyles } from './withTableStyles';
import tinycolor from 'tinycolor2';
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
  const columns: Column[] = [];
  let fieldCountWithoutWidth = data.fields.length;

  for (let fieldIndex = 0; fieldIndex < data.fields.length; fieldIndex++) {
    const field = data.fields[fieldIndex];
    const fieldTableOptions = (field.config.custom || {}) as TableFieldOptions;

    if (fieldTableOptions.width) {
      availableWidth -= fieldTableOptions.width;
      fieldCountWithoutWidth -= 1;
    }

    const Cell = getCellComponent(fieldTableOptions.displayMode, field);

    columns.push({
      Cell,
      id: fieldIndex.toString(),
      Header: field.config.title ?? field.name,
      accessor: (row: any, i: number) => {
        return field.values.get(i);
      },
      width: fieldTableOptions.width,
      minWidth: 50,
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

export function isNullOrUndefined(value: any) {
  if (value === undefined || value === null) {
    return true;
  }
  return false;
}

function getCellComponent(displayMode: TableCellDisplayMode, field: Field) {
  switch (displayMode) {
    case TableCellDisplayMode.ColorText:
      return withTableStyles(DefaultCell, getTextColorStyle);
    case TableCellDisplayMode.ColorBackground:
      return withTableStyles(DefaultCell, getBackgroundColorStyle);
    case TableCellDisplayMode.LcdGauge:
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
