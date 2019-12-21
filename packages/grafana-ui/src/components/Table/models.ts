import { ComponentType } from 'react';
import { DataFrame, Field, formattedValueToString, GrafanaTheme } from '@grafana/data';

export interface FieldTableOptions {
  width: number;
}

export interface TableColumn {
  // React table props
  Header: string;
  accessor: string | Function;
  Cell?: (props: ReactTableCellProps) => string | ComponentType<ReactTableCellProps>;
  // Grafana additions
  field: Field;
  width: number;
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

export function getColumns(data: DataFrame, theme: GrafanaTheme): TableColumn[] {
  const cols: TableColumn[] = [];

  for (const field of data.fields) {
    const tableOptions = (field.config.custom || {}) as FieldTableOptions;

    cols.push({
      field,
      Header: field.name,
      accessor: field.name,
      Cell: formatCellValue,
      width: tableOptions.width || 100,
    });
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
