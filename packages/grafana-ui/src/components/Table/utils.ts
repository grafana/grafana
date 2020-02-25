import { TextAlignProperty } from 'csstype';
import { DataFrame, Field, FieldType } from '@grafana/data';
import { Column } from 'react-table';
import { DefaultCell } from './DefaultCell';
import { BarGaugeCell } from './BarGaugeCell';
import { BackgroundColoredCell } from './BackgroundColorCell';
import { TableRow, TableFieldOptions, TableCellDisplayMode } from './types';

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

export function getTextAlign(field: Field): TextAlignProperty {
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
      Header: field.name,
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
    case TableCellDisplayMode.ColorBackground:
      return BackgroundColoredCell;
    case TableCellDisplayMode.LcdGauge:
    case TableCellDisplayMode.GradientGauge:
      return BarGaugeCell;
    default:
      return DefaultCell;
  }
}
