import * as tslib_1 from "tslib";
import React, { PureComponent } from 'react';
import * as rangeUtil from 'app/core/utils/rangeutil';
import { Switch } from '@grafana/ui';
import TimeSeries from 'app/core/time_series2';
import { LogsDedupDescription, LogsDedupStrategy, LogLevel, LogsMetaKind } from 'app/core/logs_model';
import ToggleButtonGroup, { ToggleButton } from 'app/core/components/ToggleButtonGroup/ToggleButtonGroup';
import Graph from './Graph';
import { LogLabels } from './LogLabels';
import { LogRow } from './LogRow';
var PREVIEW_LIMIT = 100;
var graphOptions = {
    series: {
        stack: true,
        bars: {
            show: true,
            lineWidth: 5,
        },
    },
    yaxis: {
        tickDecimals: 0,
    },
};
function renderMetaItem(value, kind) {
    if (kind === LogsMetaKind.LabelsMap) {
        return (React.createElement("span", { className: "logs-meta-item__labels" },
            React.createElement(LogLabels, { labels: value, plain: true })));
    }
    return value;
}
var Logs = /** @class */ (function (_super) {
    tslib_1.__extends(Logs, _super);
    function Logs() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.state = {
            deferLogs: true,
            renderAll: false,
            showLabels: false,
            showLocalTime: true,
            showUtc: false,
        };
        _this.onChangeDedup = function (dedup) {
            var onDedupStrategyChange = _this.props.onDedupStrategyChange;
            if (_this.props.dedupStrategy === dedup) {
                return onDedupStrategyChange(LogsDedupStrategy.none);
            }
            return onDedupStrategyChange(dedup);
        };
        _this.onChangeLabels = function (event) {
            var target = event.target;
            _this.setState({
                showLabels: target.checked,
            });
        };
        _this.onChangeLocalTime = function (event) {
            var target = event.target;
            _this.setState({
                showLocalTime: target.checked,
            });
        };
        _this.onChangeUtc = function (event) {
            var target = event.target;
            _this.setState({
                showUtc: target.checked,
            });
        };
        _this.onToggleLogLevel = function (rawLevel, hiddenRawLevels) {
            var hiddenLogLevels = new Set(Array.from(hiddenRawLevels).map(function (level) { return LogLevel[level]; }));
            _this.props.onToggleLogLevel(hiddenLogLevels);
        };
        _this.onClickScan = function (event) {
            event.preventDefault();
            _this.props.onStartScanning();
        };
        _this.onClickStopScan = function (event) {
            event.preventDefault();
            _this.props.onStopScanning();
        };
        return _this;
    }
    Logs.prototype.componentDidMount = function () {
        var _this = this;
        // Staged rendering
        if (this.state.deferLogs) {
            var data = this.props.data;
            var rowCount = data && data.rows ? data.rows.length : 0;
            // Render all right away if not too far over the limit
            var renderAll_1 = rowCount <= PREVIEW_LIMIT * 2;
            this.deferLogsTimer = setTimeout(function () { return _this.setState({ deferLogs: false, renderAll: renderAll_1 }); }, rowCount);
        }
    };
    Logs.prototype.componentDidUpdate = function (prevProps, prevState) {
        var _this = this;
        // Staged rendering
        if (prevState.deferLogs && !this.state.deferLogs && !this.state.renderAll) {
            this.renderAllTimer = setTimeout(function () { return _this.setState({ renderAll: true }); }, 2000);
        }
    };
    Logs.prototype.componentWillUnmount = function () {
        clearTimeout(this.deferLogsTimer);
        clearTimeout(this.renderAllTimer);
    };
    Logs.prototype.render = function () {
        var _this = this;
        var _a = this.props, data = _a.data, exploreId = _a.exploreId, highlighterExpressions = _a.highlighterExpressions, _b = _a.loading, loading = _b === void 0 ? false : _b, onClickLabel = _a.onClickLabel, range = _a.range, scanning = _a.scanning, scanRange = _a.scanRange, width = _a.width, dedupedData = _a.dedupedData;
        if (!data) {
            return null;
        }
        var _c = this.state, deferLogs = _c.deferLogs, renderAll = _c.renderAll, showLabels = _c.showLabels, showLocalTime = _c.showLocalTime, showUtc = _c.showUtc;
        var dedupStrategy = this.props.dedupStrategy;
        var hasData = data && data.rows && data.rows.length > 0;
        var dedupCount = dedupedData.rows.reduce(function (sum, row) { return sum + row.duplicates; }, 0);
        var showDuplicates = dedupStrategy !== LogsDedupStrategy.none && dedupCount > 0;
        var meta = tslib_1.__spread(data.meta);
        if (dedupStrategy !== LogsDedupStrategy.none) {
            meta.push({
                label: 'Dedup count',
                value: dedupCount,
                kind: LogsMetaKind.Number,
            });
        }
        // Staged rendering
        var processedRows = dedupedData.rows;
        var firstRows = processedRows.slice(0, PREVIEW_LIMIT);
        var lastRows = processedRows.slice(PREVIEW_LIMIT);
        var scanText = scanRange ? "Scanning " + rangeUtil.describeTimeRange(scanRange) : 'Scanning...';
        // React profiler becomes unusable if we pass all rows to all rows and their labels, using getter instead
        var getRows = function () { return processedRows; };
        var timeSeries = data.series.map(function (series) { return new TimeSeries(series); });
        return (React.createElement("div", { className: "logs-panel" },
            React.createElement("div", { className: "logs-panel-graph" },
                React.createElement(Graph, { data: timeSeries, height: 100, width: width, range: range, id: "explore-logs-graph-" + exploreId, onChangeTime: this.props.onChangeTime, onToggleSeries: this.onToggleLogLevel, userOptions: graphOptions })),
            React.createElement("div", { className: "logs-panel-options" },
                React.createElement("div", { className: "logs-panel-controls" },
                    React.createElement(Switch, { label: "Timestamp", checked: showUtc, onChange: this.onChangeUtc, transparent: true }),
                    React.createElement(Switch, { label: "Local time", checked: showLocalTime, onChange: this.onChangeLocalTime, transparent: true }),
                    React.createElement(Switch, { label: "Labels", checked: showLabels, onChange: this.onChangeLabels, transparent: true }),
                    React.createElement(ToggleButtonGroup, { label: "Dedup", transparent: true }, Object.keys(LogsDedupStrategy).map(function (dedupType, i) { return (React.createElement(ToggleButton, { key: i, value: dedupType, onChange: _this.onChangeDedup, selected: dedupStrategy === dedupType, tooltip: LogsDedupDescription[dedupType] }, dedupType)); })))),
            hasData && meta && (React.createElement("div", { className: "logs-panel-meta" }, meta.map(function (item) { return (React.createElement("div", { className: "logs-panel-meta__item", key: item.label },
                React.createElement("span", { className: "logs-panel-meta__label" },
                    item.label,
                    ":"),
                React.createElement("span", { className: "logs-panel-meta__value" }, renderMetaItem(item.value, item.kind)))); }))),
            React.createElement("div", { className: "logs-rows" },
                hasData &&
                    !deferLogs && // Only inject highlighterExpression in the first set for performance reasons
                    firstRows.map(function (row) { return (React.createElement(LogRow, { key: row.key + row.duplicates, getRows: getRows, highlighterExpressions: highlighterExpressions, row: row, showDuplicates: showDuplicates, showLabels: showLabels, showLocalTime: showLocalTime, showUtc: showUtc, onClickLabel: onClickLabel })); }),
                hasData &&
                    !deferLogs &&
                    renderAll &&
                    lastRows.map(function (row) { return (React.createElement(LogRow, { key: row.key + row.duplicates, getRows: getRows, row: row, showDuplicates: showDuplicates, showLabels: showLabels, showLocalTime: showLocalTime, showUtc: showUtc, onClickLabel: onClickLabel })); }),
                hasData && deferLogs && React.createElement("span", null,
                    "Rendering ",
                    dedupedData.rows.length,
                    " rows...")),
            !loading && !hasData && !scanning && (React.createElement("div", { className: "logs-panel-nodata" },
                "No logs found.",
                React.createElement("a", { className: "link", onClick: this.onClickScan }, "Scan for older logs"))),
            scanning && (React.createElement("div", { className: "logs-panel-nodata" },
                React.createElement("span", null, scanText),
                React.createElement("a", { className: "link", onClick: this.onClickStopScan }, "Stop scan")))));
    };
    return Logs;
}(PureComponent));
export default Logs;
//# sourceMappingURL=Logs.js.map