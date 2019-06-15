import TableModel from 'app/core/table_model';

export interface TableTransform {
  description: string;
  getColumns(data?: any): any[];
  transform(data: any, panel: any, model: TableModel): void;
}
