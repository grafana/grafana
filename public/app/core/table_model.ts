interface Column {
  text: string;
  title?: string;
  type?: string;
  sort?: boolean;
  desc?: boolean;
  filterable?: boolean;
  unit?: string;
}

export default class TableModel {
  columns: Column[];
  rows: any[];
  type: string;
  columnMap: any;

  constructor() {
    this.columns = [];
    this.columnMap = {};
    this.rows = [];
    this.type = 'table';
  }

  sort(options) {
    if (options.col === null || this.columns.length <= options.col) {
      return;
    }

    this.rows.sort((a, b) => {
      a = a[options.col];
      b = b[options.col];
      // Sort null or undefined seperately from comparable values
      return +(a == null) - +(b == null) || +(a > b) || -(a < b);
    });

    if (options.desc) {
      this.rows.reverse();
    }

    this.columns[options.col].sort = true;
    this.columns[options.col].desc = options.desc;
  }

  addColumn(col) {
    if (!this.columnMap[col.text]) {
      this.columns.push(col);
      this.columnMap[col.text] = col;
    }
  }

  addRow(row) {
    this.rows.push(row);
  }
}
