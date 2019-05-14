import * as tslib_1 from "tslib";
import _ from 'lodash';
var TableModel = /** @class */ (function () {
    function TableModel(table) {
        var _this = this;
        this.columns = [];
        this.columnMap = {};
        this.rows = [];
        this.type = 'table';
        if (table) {
            if (table.columns) {
                table.columns.forEach(function (col) { return _this.addColumn(col); });
            }
            if (table.rows) {
                table.rows.forEach(function (row) { return _this.addRow(row); });
            }
        }
    }
    TableModel.prototype.sort = function (options) {
        if (options.col === null || this.columns.length <= options.col) {
            return;
        }
        this.rows.sort(function (a, b) {
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
    };
    TableModel.prototype.addColumn = function (col) {
        if (!this.columnMap[col.text]) {
            this.columns.push(col);
            this.columnMap[col.text] = col;
        }
    };
    TableModel.prototype.addRow = function (row) {
        this.rows.push(row);
    };
    return TableModel;
}());
export default TableModel;
// Returns true if both rows have matching non-empty fields as well as matching
// indexes where one field is empty and the other is not
function areRowsMatching(columns, row, otherRow) {
    var foundFieldToMatch = false;
    for (var columnIndex = 0; columnIndex < columns.length; columnIndex++) {
        if (row[columnIndex] !== undefined && otherRow[columnIndex] !== undefined) {
            if (row[columnIndex] !== otherRow[columnIndex]) {
                return false;
            }
        }
        else if (row[columnIndex] === undefined || otherRow[columnIndex] === undefined) {
            foundFieldToMatch = true;
        }
    }
    return foundFieldToMatch;
}
export function mergeTablesIntoModel(dst) {
    var tables = [];
    for (var _i = 1; _i < arguments.length; _i++) {
        tables[_i - 1] = arguments[_i];
    }
    var model = dst || new TableModel();
    if (arguments.length === 1) {
        return model;
    }
    // Single query returns data columns and rows as is
    if (arguments.length === 2) {
        model.columns = tables[0].hasOwnProperty('columns') ? tslib_1.__spread(tables[0].columns) : [];
        model.rows = tables[0].hasOwnProperty('rows') ? tslib_1.__spread(tables[0].rows) : [];
        return model;
    }
    // Track column indexes of union: name -> index
    var columnNames = {};
    // Union of all non-value columns
    var columnsUnion = tables.slice().reduce(function (acc, series) {
        series.columns.forEach(function (col) {
            var text = col.text;
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
    var columnIndexMapper = tables.map(function (series) { return series.columns.map(function (col) { return columnNames[col.text]; }); });
    // Flatten rows of all series and adjust new column indexes
    var flattenedRows = tables.reduce(function (acc, series, seriesIndex) {
        var mapper = columnIndexMapper[seriesIndex];
        series.rows.forEach(function (row) {
            var alteredRow = [];
            // Shifting entries according to index mapper
            mapper.forEach(function (to, from) {
                alteredRow[to] = row[from];
            });
            acc.push(alteredRow);
        });
        return acc;
    }, []);
    // Merge rows that have same values for columns
    var mergedRows = {};
    var compactedRows = flattenedRows.reduce(function (acc, row, rowIndex) {
        if (!mergedRows[rowIndex]) {
            // Look from current row onwards
            var offset = rowIndex + 1;
            // More than one row can be merged into current row
            while (offset < flattenedRows.length) {
                // Find next row that could be merged
                var match = _.findIndex(flattenedRows, function (otherRow) { return areRowsMatching(columnsUnion, row, otherRow); }, offset);
                if (match > -1) {
                    var matchedRow = flattenedRows[match];
                    // Merge values from match into current row if there is a gap in the current row
                    for (var columnIndex = 0; columnIndex < columnsUnion.length; columnIndex++) {
                        if (row[columnIndex] === undefined && matchedRow[columnIndex] !== undefined) {
                            row[columnIndex] = matchedRow[columnIndex];
                        }
                    }
                    // Don't visit this row again
                    mergedRows[match] = matchedRow;
                    // Keep looking for more rows to merge
                    offset = match + 1;
                }
                else {
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
//# sourceMappingURL=table_model.js.map