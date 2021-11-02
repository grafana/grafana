import { __extends } from "tslib";
import React, { PureComponent } from 'react';
import memoizeOne from 'memoize-one';
import { LogsDedupStrategy, sortLogRows } from '@grafana/data';
import { withTheme2 } from '../../themes/index';
import { getLogRowStyles } from './getLogRowStyles';
//Components
import { LogRow } from './LogRow';
export var PREVIEW_LIMIT = 100;
var UnThemedLogRows = /** @class */ (function (_super) {
    __extends(UnThemedLogRows, _super);
    function UnThemedLogRows() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.renderAllTimer = null;
        _this.state = {
            renderAll: false,
        };
        _this.makeGetRows = memoizeOne(function (orderedRows) {
            return function () { return orderedRows; };
        });
        _this.sortLogs = memoizeOne(function (logRows, logsSortOrder) {
            return sortLogRows(logRows, logsSortOrder);
        });
        return _this;
    }
    UnThemedLogRows.prototype.componentDidMount = function () {
        var _this = this;
        // Staged rendering
        var _a = this.props, logRows = _a.logRows, previewLimit = _a.previewLimit;
        var rowCount = logRows ? logRows.length : 0;
        // Render all right away if not too far over the limit
        var renderAll = rowCount <= previewLimit * 2;
        if (renderAll) {
            this.setState({ renderAll: renderAll });
        }
        else {
            this.renderAllTimer = window.setTimeout(function () { return _this.setState({ renderAll: true }); }, 2000);
        }
    };
    UnThemedLogRows.prototype.componentWillUnmount = function () {
        if (this.renderAllTimer) {
            clearTimeout(this.renderAllTimer);
        }
    };
    UnThemedLogRows.prototype.render = function () {
        var _a = this.props, dedupStrategy = _a.dedupStrategy, showContextToggle = _a.showContextToggle, showLabels = _a.showLabels, showTime = _a.showTime, wrapLogMessage = _a.wrapLogMessage, prettifyLogMessage = _a.prettifyLogMessage, logRows = _a.logRows, deduplicatedRows = _a.deduplicatedRows, timeZone = _a.timeZone, onClickFilterLabel = _a.onClickFilterLabel, onClickFilterOutLabel = _a.onClickFilterOutLabel, theme = _a.theme, enableLogDetails = _a.enableLogDetails, previewLimit = _a.previewLimit, getFieldLinks = _a.getFieldLinks, logsSortOrder = _a.logsSortOrder, showDetectedFields = _a.showDetectedFields, onClickShowDetectedField = _a.onClickShowDetectedField, onClickHideDetectedField = _a.onClickHideDetectedField, forceEscape = _a.forceEscape, onLogRowHover = _a.onLogRowHover;
        var renderAll = this.state.renderAll;
        var logsRowsTable = getLogRowStyles(theme).logsRowsTable;
        var dedupedRows = deduplicatedRows ? deduplicatedRows : logRows;
        var hasData = logRows && logRows.length > 0;
        var dedupCount = dedupedRows
            ? dedupedRows.reduce(function (sum, row) { return (row.duplicates ? sum + row.duplicates : sum); }, 0)
            : 0;
        var showDuplicates = dedupStrategy !== LogsDedupStrategy.none && dedupCount > 0;
        // Staged rendering
        var processedRows = dedupedRows ? dedupedRows : [];
        var orderedRows = logsSortOrder ? this.sortLogs(processedRows, logsSortOrder) : processedRows;
        var firstRows = orderedRows.slice(0, previewLimit);
        var lastRows = orderedRows.slice(previewLimit, orderedRows.length);
        // React profiler becomes unusable if we pass all rows to all rows and their labels, using getter instead
        var getRows = this.makeGetRows(orderedRows);
        var getRowContext = this.props.getRowContext ? this.props.getRowContext : function () { return Promise.resolve([]); };
        return (React.createElement("table", { className: logsRowsTable },
            React.createElement("tbody", null,
                hasData &&
                    firstRows.map(function (row, index) { return (React.createElement(LogRow, { key: row.uid, getRows: getRows, getRowContext: getRowContext, row: row, showContextToggle: showContextToggle, showDuplicates: showDuplicates, showLabels: showLabels, showTime: showTime, showDetectedFields: showDetectedFields, wrapLogMessage: wrapLogMessage, prettifyLogMessage: prettifyLogMessage, timeZone: timeZone, enableLogDetails: enableLogDetails, onClickFilterLabel: onClickFilterLabel, onClickFilterOutLabel: onClickFilterOutLabel, onClickShowDetectedField: onClickShowDetectedField, onClickHideDetectedField: onClickHideDetectedField, getFieldLinks: getFieldLinks, logsSortOrder: logsSortOrder, forceEscape: forceEscape, onLogRowHover: onLogRowHover })); }),
                hasData &&
                    renderAll &&
                    lastRows.map(function (row, index) { return (React.createElement(LogRow, { key: row.uid, getRows: getRows, getRowContext: getRowContext, row: row, showContextToggle: showContextToggle, showDuplicates: showDuplicates, showLabels: showLabels, showTime: showTime, showDetectedFields: showDetectedFields, wrapLogMessage: wrapLogMessage, prettifyLogMessage: prettifyLogMessage, timeZone: timeZone, enableLogDetails: enableLogDetails, onClickFilterLabel: onClickFilterLabel, onClickFilterOutLabel: onClickFilterOutLabel, onClickShowDetectedField: onClickShowDetectedField, onClickHideDetectedField: onClickHideDetectedField, getFieldLinks: getFieldLinks, logsSortOrder: logsSortOrder, forceEscape: forceEscape, onLogRowHover: onLogRowHover })); }),
                hasData && !renderAll && (React.createElement("tr", null,
                    React.createElement("td", { colSpan: 5 },
                        "Rendering ",
                        orderedRows.length - previewLimit,
                        " rows..."))))));
    };
    UnThemedLogRows.defaultProps = {
        previewLimit: PREVIEW_LIMIT,
    };
    return UnThemedLogRows;
}(PureComponent));
export var LogRows = withTheme2(UnThemedLogRows);
LogRows.displayName = 'LogsRows';
//# sourceMappingURL=LogRows.js.map