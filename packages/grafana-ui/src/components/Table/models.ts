import { TextAlignProperty } from 'csstype';
import { ComponentType } from 'react';
import { DataFrame, Field, formattedValueToString, GrafanaTheme, FieldType } from '@grafana/data';

export interface FieldTableOptions {
  width: number;
  align: FieldTextAlignment;
}

export type FieldTextAlignment = 'auto' | 'left' | 'right' | 'center';

export interface TableColumn {
  // React table props
  Header: string;
  accessor: string | Function;
  Cell?: (props: ReactTableCellProps) => string | ComponentType<ReactTableCellProps>;
  // Grafana additions
  field: Field;
  width: number;
  textAlign: TextAlignProperty;
}

export interface TableRow {
  [x: string]: any;
}

export interface ReactTableCellProps {
  cell: ReactTableCell;
  column: TableColumn;
}

export interface ReactTableCell {
  value: any;
}

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

    cols.push({
      field,
      Header: field.name,
      accessor: field.name,
      Cell: formatCellValue,
      width: fieldTableOptions.width,
      textAlign: getTextAlign(field),
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

export function formatCellValue(props: ReactTableCellProps): string {
  // if field has a display processor use that
  if (props.column.field.display) {
    const displayValue = props.column.field.display(props.cell.value);
    return formattedValueToString(displayValue);
  }

  return String(props.cell.value);
}
