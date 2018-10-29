import _ from 'lodash';

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

  constructor(table?: any) {
    this.columns = [];
    this.columnMap = {};
    this.rows = [];
    this.type = 'table';

    if (table) {
      if (table.columns) {
        table.columns.forEach(col => this.addColumn(col));
      }
      if (table.rows) {
        table.rows.forEach(row => this.addRow(row));
      }
    }
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

// Returns true if both rows have matching non-empty fields as well as matching
// indexes where one field is empty and the other is not
function areRowsMatching(columns, row, otherRow) {
  let foundFieldToMatch = false;
  for (let columnIndex = 0; columnIndex < columns.length; columnIndex++) {
    if (row[columnIndex] !== undefined && otherRow[columnIndex] !== undefined) {
      if (row[columnIndex] !== otherRow[columnIndex]) {
        return false;
      }
    } else if (row[columnIndex] === undefined || otherRow[columnIndex] === undefined) {
      foundFieldToMatch = true;
    }
  }
  return foundFieldToMatch;
}

export function mergeTablesIntoModel(dst?: TableModel, ...tables: TableModel[]): TableModel {
  const model = dst || new TableModel();

  // Single query returns data columns and rows as is
  if (arguments.length === 2) {
    model.columns = [...tables[0].columns];
    model.rows = [...tables[0].rows];
    return model;
  }

  // Track column indexes of union: name -> index
  const columnNames = {};

  // Union of all non-value columns
  const columnsUnion = tables.slice().reduce((acc, series) => {
    series.columns.forEach(col => {
      const { text } = col;
      if (columnNames[text] === undefined) {
        columnNames[text] = acc.length;
        acc.push(col);
      }
    });
    return acc;
  }, []);

  // Map old column index to union index per series, e.g.,
  // given columnNames {A: 0, B: 1} and
  // data [{columns: [{ text: 'A' }]}, {columns: [{ text: 'B' }]}] => [[0], [1]]
  const columnIndexMapper = tables.map(series => series.columns.map(col => columnNames[col.text]));

  // Flatten rows of all series and adjust new column indexes
  const flattenedRows = tables.reduce((acc, series, seriesIndex) => {
    const mapper = columnIndexMapper[seriesIndex];
    series.rows.forEach(row => {
      const alteredRow = [];
      // Shifting entries according to index mapper
      mapper.forEach((to, from) => {
        alteredRow[to] = row[from];
      });
      acc.push(alteredRow);
    });
    return acc;
  }, []);

  // Merge rows that have same values for columns
  const mergedRows = {};
  const compactedRows = flattenedRows.reduce((acc, row, rowIndex) => {
    if (!mergedRows[rowIndex]) {
      // Look from current row onwards
      let offset = rowIndex + 1;
      // More than one row can be merged into current row
      while (offset < flattenedRows.length) {
        // Find next row that could be merged
        const match = _.findIndex(flattenedRows, otherRow => areRowsMatching(columnsUnion, row, otherRow), offset);
        if (match > -1) {
          const matchedRow = flattenedRows[match];
          // Merge values from match into current row if there is a gap in the current row
          for (let columnIndex = 0; columnIndex < columnsUnion.length; columnIndex++) {
            if (row[columnIndex] === undefined && matchedRow[columnIndex] !== undefined) {
              row[columnIndex] = matchedRow[columnIndex];
            }
          }
          // Don't visit this row again
          mergedRows[match] = matchedRow;
          // Keep looking for more rows to merge
          offset = match + 1;
        } else {
          // No match found, stop looking
          break;
        }
      }
      acc.push(row);
    }
    return acc;
  }, []);

  model.columns = columnsUnion;
  model.rows = compactedRows;
  return model;
}
