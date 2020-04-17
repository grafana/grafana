import { TextAlignProperty } from 'csstype';
import { DataFrame, Field, FieldType } from '@grafana/data';
import { Column } from 'react-table';
import { DefaultCell } from './DefaultCell';
import { BarGaugeCell } from './BarGaugeCell';
import { TableCellDisplayMode, TableCellProps, TableFieldOptions, TableRow } from './types';
import { css, cx } from 'emotion';
import { withTableStyles } from './withTableStyles';
import tinycolor from 'tinycolor2';

export function getTableRows(data: DataFrame): TableRow[] {
  const tableData = [];

  for (let i = 0; i < data.length; i++) {
    const row: { [key: string]: string | number } = {};
    for (let j = 0; j < data.fields.length; j++) {
      const prop = data.fields[j].name;
      row[prop] = data.fields[j].values.get(i);
    }
    tableData.push(row);
  }

  return tableData;
}

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

  for (const field of data.fields) {
    const fieldTableOptions = (field.config.custom || {}) as TableFieldOptions;
    if (fieldTableOptions.width) {
      availableWidth -= fieldTableOptions.width;
      fieldCountWithoutWidth -= 1;
    }

    const Cell = getCellComponent(fieldTableOptions.displayMode);

    columns.push({
      Cell,
      id: field.name,
      Header: field.config.title ?? field.name,
      accessor: field.name,
      width: fieldTableOptions.width,
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

function getCellComponent(displayMode: TableCellDisplayMode) {
  switch (displayMode) {
    case TableCellDisplayMode.ColorText:
      return withTableStyles(DefaultCell, getTextColorStyle);
    case TableCellDisplayMode.ColorBackground:
      return withTableStyles(DefaultCell, getBackgroundColorStyle);
    case TableCellDisplayMode.LcdGauge:
    case TableCellDisplayMode.GradientGauge:
      return BarGaugeCell;
    default:
      return DefaultCell;
  }
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
