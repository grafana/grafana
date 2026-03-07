import { Column, TableData, QueryResultMeta } from '@grafana/data';

/**
 * Extends the standard Column class with variables that get
 * mutated in the angular table panel.
 */
export interface MutableColumn extends Column {
  title?: string;
  sort?: boolean;
  desc?: boolean;
  type?: string;
}

export default class TableModel implements TableData {
  columns: MutableColumn[];
  rows: any[];
  type: string;
  columnMap: Record<string, Column>;
  refId?: string;
  meta?: QueryResultMeta;

  constructor(table?: any) {
    this.columns = [];
    this.columnMap = {};
    this.rows = [];
    this.type = 'table';

    if (table) {
      if (table.columns) {
        for (const col of table.columns) {
          this.addColumn(col);
        }
      }
      if (table.rows) {
        for (const row of table.rows) {
          this.addRow(row);
        }
      }
    }
  }

  sort(options: { col: number; desc: boolean }) {
    // Since 8.3.0 col property can be also undefined, https://github.com/grafana/grafana/issues/44127
    if (options.col === null || options.col === undefined || this.columns.length <= options.col) {
      return;
    }

    this.rows.sort((a, b) => {
      a = a[options.col];
      b = b[options.col];
      // Sort null or undefined separately from comparable values
      return +(a == null) - +(b == null) || +(a > b) || -(a < b);
    });

    if (options.desc) {
      this.rows.reverse();
    }

    this.columns[options.col].sort = true;
    this.columns[options.col].desc = options.desc;
  }

  addColumn(col: Column) {
    if (!this.columnMap[col.text]) {
      this.columns.push(col);
      this.columnMap[col.text] = col;
    }
  }

  addRow(row: unknown[]) {
    this.rows.push(row);
  }
}
