import { TextAlignProperty } from 'csstype';
import { DataFrame, Field, GrafanaTheme, FieldType } from '@grafana/data';
import { TableColumn, TableRow, FieldTableOptions, CellDisplayMode } from './types';
import { BarGaugeCell } from './BarGaugeCell';
import { DefaultCell } from './DefaultCell';

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

function getTextAlign(field: Field): TextAlignProperty {
  if (field.type === FieldType.number) {
    return 'right';
  }

  return 'left';
}

export function getColumns(data: DataFrame, availableWidth: number, theme: GrafanaTheme): TableColumn[] {
  const cols: TableColumn[] = [];
  let fieldCountWithoutWidth = data.fields.length;

  for (const field of data.fields) {
    const fieldTableOptions = (field.config.custom || {}) as FieldTableOptions;

    if (fieldTableOptions.width) {
      availableWidth -= fieldTableOptions.width;
      fieldCountWithoutWidth -= 1;
    }

    let Cell = DefaultCell;
    let textAlign = getTextAlign(field);

    if (fieldTableOptions.displayMode === CellDisplayMode.BarGauge) {
      Cell = BarGaugeCell;
      textAlign = 'center';
    }

    cols.push({
      field,
      Cell,
      textAlign,
      Header: field.name,
      accessor: field.name,
      width: fieldTableOptions.width,
    });
  }

  // divide up the rest of the space
  const sharedWidth = availableWidth / fieldCountWithoutWidth;
  for (const column of cols) {
    if (!column.width) {
      column.width = sharedWidth;
    }
  }

  return cols;
}
