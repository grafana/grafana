import TableModel from 'app/core/table_model';
import { Column } from '@grafana/data';
import { ColumnStyle } from '@grafana/ui/src/components/Table/TableCellBuilder';

export interface TableColumnStyle extends ColumnStyle {
  useSeriesUnit: boolean;
}

export interface TableTransform {
  description: string;
  getColumns(data?: any): any[];
  transform(data: any, panel: any, model: TableModel): void;
}

export interface ColumnRender extends Column {
  title: string;
  style: TableColumnStyle;
  hidden: boolean;
  unit: string;
}

export interface TableRenderModel {
  columns: ColumnRender[];
  rows: any[][];
}
