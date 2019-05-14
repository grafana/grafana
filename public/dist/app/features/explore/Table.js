import * as tslib_1 from "tslib";
import _ from 'lodash';
import React, { PureComponent } from 'react';
import ReactTable from 'react-table';
import TableModel from 'app/core/table_model';
var EMPTY_TABLE = new TableModel();
// Identify columns that contain values
var VALUE_REGEX = /^[Vv]alue #\d+/;
function prepareRows(rows, columnNames) {
    return rows.map(function (cells) { return _.zipObject(columnNames, cells); });
}
var Table = /** @class */ (function (_super) {
    tslib_1.__extends(Table, _super);
    function Table() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.getCellProps = function (state, rowInfo, column) {
            return {
                onClick: function (e) {
                    // Only handle click on link, not the cell
                    if (e.target) {
                        var link = e.target;
                        if (link.className === 'link') {
                            var columnKey = column.Header;
                            var rowValue = rowInfo.row[columnKey];
                            _this.props.onClickCell(columnKey, rowValue);
                        }
                    }
                },
            };
        };
        return _this;
    }
    Table.prototype.render = function () {
        var _a = this.props, data = _a.data, loading = _a.loading;
        var tableModel = data || EMPTY_TABLE;
        var columnNames = tableModel.columns.map(function (_a) {
            var text = _a.text;
            return text;
        });
        var columns = tableModel.columns.map(function (_a) {
            var filterable = _a.filterable, text = _a.text;
            return ({
                Header: function () { return React.createElement("span", { title: text }, text); },
                accessor: text,
                className: VALUE_REGEX.test(text) ? 'text-right' : '',
                show: text !== 'Time',
                Cell: function (row) { return (React.createElement("span", { className: filterable ? 'link' : '', title: text + ': ' + row.value }, row.value)); },
            });
        });
        var noDataText = data ? 'The queries returned no data for a table.' : '';
        return (React.createElement(ReactTable, { columns: columns, data: tableModel.rows, getTdProps: this.getCellProps, loading: loading, minRows: 0, noDataText: noDataText, resolveData: function (data) { return prepareRows(data, columnNames); }, showPagination: Boolean(data) }));
    };
    return Table;
}(PureComponent));
export default Table;
//# sourceMappingURL=Table.js.map