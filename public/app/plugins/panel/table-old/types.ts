import TableModel from 'app/core/table_model';
import { Column } from '@grafana/data';

export interface TableTransform {
  description: string;
  getColumns(data?: any): any[];
  transform(data: any, panel: any, model: TableModel): void;
}

export interface ColumnRender extends Column {
  title: string;
  style: ColumnStyle;
  hidden: boolean;
}

export interface TableRenderModel {
  columns: ColumnRender[];
  rows: any[][];
}

export interface ColumnStyle {
  pattern: string;

  alias?: string;
  colorMode?: 'cell' | 'value';
  colors?: any[];
  decimals?: number;
  thresholds?: any[];
  type?: 'date' | 'number' | 'string' | 'hidden';
  unit?: string;
  dateFormat?: string;
  sanitize?: boolean; // not used in react
  mappingType?: any;
  valueMaps?: any;
  rangeMaps?: any;
  align?: 'auto' | 'left' | 'center' | 'right';
  link?: any;
  linkUrl?: any;
  linkTooltip?: any;
  linkTargetBlank?: boolean;
  preserveFormat?: boolean;
}
