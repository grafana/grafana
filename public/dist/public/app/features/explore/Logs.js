import { __extends, __makeTemplateObject } from "tslib";
import React, { PureComponent, createRef } from 'react';
import { css } from '@emotion/css';
import { capitalize } from 'lodash';
import memoizeOne from 'memoize-one';
import { TooltipDisplayMode } from '@grafana/schema';
import { rangeUtil, LogLevel, LogsDedupStrategy, LogsDedupDescription, LogsSortOrder, } from '@grafana/data';
import { RadioButtonGroup, LogRows, Button, InlineField, InlineFieldRow, InlineSwitch, withTheme2, } from '@grafana/ui';
import store from 'app/core/store';
import { dedupLogRows, filterLogLevels } from 'app/core/logs_model';
import { LogsMetaRow } from './LogsMetaRow';
import LogsNavigation from './LogsNavigation';
import { ExploreGraph } from './ExploreGraph';
var SETTINGS_KEYS = {
    showLabels: 'grafana.explore.logs.showLabels',
    showTime: 'grafana.explore.logs.showTime',
    wrapLogMessage: 'grafana.explore.logs.wrapLogMessage',
    prettifyLogMessage: 'grafana.explore.logs.prettifyLogMessage',
};
var UnthemedLogs = /** @class */ (function (_super) {
    __extends(UnthemedLogs, _super);
    function UnthemedLogs() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.topLogsRef = createRef();
        _this.state = {
            showLabels: store.getBool(SETTINGS_KEYS.showLabels, false),
            showTime: store.getBool(SETTINGS_KEYS.showTime, true),
            wrapLogMessage: store.getBool(SETTINGS_KEYS.wrapLogMessage, true),
            prettifyLogMessage: store.getBool(SETTINGS_KEYS.prettifyLogMessage, false),
            dedupStrategy: LogsDedupStrategy.none,
            hiddenLogLevels: [],
            logsSortOrder: null,
            isFlipping: false,
            showDetectedFields: [],
            forceEscape: false,
        };
        _this.onChangeLogsSortOrder = function () {
            _this.setState({ isFlipping: true });
            // we are using setTimeout here to make sure that disabled button is rendered before the rendering of reordered logs
            _this.flipOrderTimer = window.setTimeout(function () {
                _this.setState(function (prevState) {
                    if (prevState.logsSortOrder === null || prevState.logsSortOrder === LogsSortOrder.Descending) {
                        return { logsSortOrder: LogsSortOrder.Ascending };
                    }
                    return { logsSortOrder: LogsSortOrder.Descending };
                });
            }, 0);
            _this.cancelFlippingTimer = window.setTimeout(function () { return _this.setState({ isFlipping: false }); }, 1000);
        };
        _this.onEscapeNewlines = function () {
            _this.setState(function (prevState) { return ({
                forceEscape: !prevState.forceEscape,
            }); });
        };
        _this.onChangeDedup = function (dedupStrategy) {
            _this.setState({ dedupStrategy: dedupStrategy });
        };
        _this.onChangeLabels = function (event) {
            var target = event.target;
            if (target) {
                var showLabels = target.checked;
                _this.setState({
                    showLabels: showLabels,
                });
                store.set(SETTINGS_KEYS.showLabels, showLabels);
            }
        };
        _this.onChangeTime = function (event) {
            var target = event.target;
            if (target) {
                var showTime = target.checked;
                _this.setState({
                    showTime: showTime,
                });
                store.set(SETTINGS_KEYS.showTime, showTime);
            }
        };
        _this.onChangewrapLogMessage = function (event) {
            var target = event.target;
            if (target) {
                var wrapLogMessage = target.checked;
                _this.setState({
                    wrapLogMessage: wrapLogMessage,
                });
                store.set(SETTINGS_KEYS.wrapLogMessage, wrapLogMessage);
            }
        };
        _this.onChangePrettifyLogMessage = function (event) {
            var target = event.target;
            if (target) {
                var prettifyLogMessage = target.checked;
                _this.setState({
                    prettifyLogMessage: prettifyLogMessage,
                });
                store.set(SETTINGS_KEYS.prettifyLogMessage, prettifyLogMessage);
            }
        };
        _this.onToggleLogLevel = function (hiddenRawLevels) {
            var hiddenLogLevels = hiddenRawLevels.map(function (level) { return LogLevel[level]; });
            _this.setState({ hiddenLogLevels: hiddenLogLevels });
        };
        _this.onClickScan = function (event) {
            event.preventDefault();
            if (_this.props.onStartScanning) {
                _this.props.onStartScanning();
            }
        };
        _this.onClickStopScan = function (event) {
            event.preventDefault();
            if (_this.props.onStopScanning) {
                _this.props.onStopScanning();
            }
        };
        _this.showDetectedField = function (key) {
            var index = _this.state.showDetectedFields.indexOf(key);
            if (index === -1) {
                _this.setState(function (state) {
                    return {
                        showDetectedFields: state.showDetectedFields.concat(key),
                    };
                });
            }
        };
        _this.hideDetectedField = function (key) {
            var index = _this.state.showDetectedFields.indexOf(key);
            if (index > -1) {
                _this.setState(function (state) {
                    return {
                        showDetectedFields: state.showDetectedFields.filter(function (k) { return key !== k; }),
                    };
                });
            }
        };
        _this.clearDetectedFields = function () {
            _this.setState(function (state) {
                return {
                    showDetectedFields: [],
                };
            });
        };
        _this.checkUnescapedContent = memoizeOne(function (logRows) {
            return !!logRows.some(function (r) { return r.hasUnescapedContent; });
        });
        _this.dedupRows = memoizeOne(function (logRows, dedupStrategy) {
            var dedupedRows = dedupLogRows(logRows, dedupStrategy);
            var dedupCount = dedupedRows.reduce(function (sum, row) { return (row.duplicates ? sum + row.duplicates : sum); }, 0);
            return { dedupedRows: dedupedRows, dedupCount: dedupCount };
        });
        _this.filterRows = memoizeOne(function (logRows, hiddenLogLevels) {
            return filterLogLevels(logRows, new Set(hiddenLogLevels));
        });
        _this.scrollToTopLogs = function () { var _a; return (_a = _this.topLogsRef.current) === null || _a === void 0 ? void 0 : _a.scrollIntoView(); };
        return _this;
    }
    UnthemedLogs.prototype.componentWillUnmount = function () {
        if (this.flipOrderTimer) {
            window.clearTimeout(this.flipOrderTimer);
        }
        if (this.cancelFlippingTimer) {
            window.clearTimeout(this.cancelFlippingTimer);
        }
    };
    UnthemedLogs.prototype.render = function () {
        var _a = this.props, width = _a.width, logRows = _a.logRows, logsMeta = _a.logsMeta, logsSeries = _a.logsSeries, visibleRange = _a.visibleRange, _b = _a.loading, loading = _b === void 0 ? false : _b, loadingState = _a.loadingState, onClickFilterLabel = _a.onClickFilterLabel, onClickFilterOutLabel = _a.onClickFilterOutLabel, timeZone = _a.timeZone, scanning = _a.scanning, scanRange = _a.scanRange, showContextToggle = _a.showContextToggle, absoluteRange = _a.absoluteRange, onChangeTime = _a.onChangeTime, getFieldLinks = _a.getFieldLinks, theme = _a.theme, logsQueries = _a.logsQueries, clearCache = _a.clearCache, addResultsToCache = _a.addResultsToCache, onClickLoadLogsVolume = _a.onClickLoadLogsVolume, loadingLogsVolumeAvailable = _a.loadingLogsVolumeAvailable;
        var _c = this.state, showLabels = _c.showLabels, showTime = _c.showTime, wrapLogMessage = _c.wrapLogMessage, prettifyLogMessage = _c.prettifyLogMessage, dedupStrategy = _c.dedupStrategy, hiddenLogLevels = _c.hiddenLogLevels, logsSortOrder = _c.logsSortOrder, isFlipping = _c.isFlipping, showDetectedFields = _c.showDetectedFields, forceEscape = _c.forceEscape;
        var styles = getStyles(theme, wrapLogMessage);
        var hasData = logRows && logRows.length > 0;
        var hasUnescapedContent = this.checkUnescapedContent(logRows);
        var filteredLogs = this.filterRows(logRows, hiddenLogLevels);
        var _d = this.dedupRows(filteredLogs, dedupStrategy), dedupedRows = _d.dedupedRows, dedupCount = _d.dedupCount;
        var scanText = scanRange ? "Scanning " + rangeUtil.describeTimeRange(scanRange) : 'Scanning...';
        return (React.createElement(React.Fragment, null,
            logsSeries && logsSeries.length ? (React.createElement(React.Fragment, null,
                React.createElement("div", { className: styles.infoText }, "This datasource does not support full-range histograms. The graph is based on the logs seen in the response."),
                React.createElement(ExploreGraph, { graphStyle: "lines", data: logsSeries, height: 150, width: width, tooltipDisplayMode: TooltipDisplayMode.Multi, absoluteRange: visibleRange || absoluteRange, timeZone: timeZone, loadingState: loadingState, onChangeTime: onChangeTime, onHiddenSeriesChanged: this.onToggleLogLevel }))) : undefined,
            React.createElement("div", { className: styles.logOptions, ref: this.topLogsRef },
                React.createElement(InlineFieldRow, null,
                    React.createElement(InlineField, { label: "Time", transparent: true },
                        React.createElement(InlineSwitch, { value: showTime, onChange: this.onChangeTime, transparent: true })),
                    React.createElement(InlineField, { label: "Unique labels", transparent: true },
                        React.createElement(InlineSwitch, { value: showLabels, onChange: this.onChangeLabels, transparent: true })),
                    React.createElement(InlineField, { label: "Wrap lines", transparent: true },
                        React.createElement(InlineSwitch, { value: wrapLogMessage, onChange: this.onChangewrapLogMessage, transparent: true })),
                    React.createElement(InlineField, { label: "Prettify JSON", transparent: true },
                        React.createElement(InlineSwitch, { value: prettifyLogMessage, onChange: this.onChangePrettifyLogMessage, transparent: true })),
                    React.createElement(InlineField, { label: "Dedup", transparent: true },
                        React.createElement(RadioButtonGroup, { options: Object.values(LogsDedupStrategy).map(function (dedupType) { return ({
                                label: capitalize(dedupType),
                                value: dedupType,
                                description: LogsDedupDescription[dedupType],
                            }); }), value: dedupStrategy, onChange: this.onChangeDedup, className: styles.radioButtons }))),
                React.createElement("div", null,
                    loadingLogsVolumeAvailable && (React.createElement(Button, { variant: "secondary", "aria-label": "Load volume button", title: "Execute a query to show full range logs volume", onClick: onClickLoadLogsVolume, icon: "graph-bar", className: styles.headerButton }, "Load volume")),
                    React.createElement(Button, { variant: "secondary", disabled: isFlipping, title: logsSortOrder === LogsSortOrder.Ascending ? 'Change to newest first' : 'Change to oldest first', "aria-label": "Flip results order", className: styles.headerButton, onClick: this.onChangeLogsSortOrder }, isFlipping ? 'Flipping...' : 'Flip results order'))),
            React.createElement(LogsMetaRow, { logRows: logRows, meta: logsMeta || [], dedupStrategy: dedupStrategy, dedupCount: dedupCount, hasUnescapedContent: hasUnescapedContent, forceEscape: forceEscape, showDetectedFields: showDetectedFields, onEscapeNewlines: this.onEscapeNewlines, clearDetectedFields: this.clearDetectedFields }),
            React.createElement("div", { className: styles.logsSection },
                React.createElement("div", { className: styles.logRows },
                    React.createElement(LogRows, { logRows: logRows, deduplicatedRows: dedupedRows, dedupStrategy: dedupStrategy, getRowContext: this.props.getRowContext, onClickFilterLabel: onClickFilterLabel, onClickFilterOutLabel: onClickFilterOutLabel, showContextToggle: showContextToggle, showLabels: showLabels, showTime: showTime, enableLogDetails: true, forceEscape: forceEscape, wrapLogMessage: wrapLogMessage, prettifyLogMessage: prettifyLogMessage, timeZone: timeZone, getFieldLinks: getFieldLinks, logsSortOrder: logsSortOrder, showDetectedFields: showDetectedFields, onClickShowDetectedField: this.showDetectedField, onClickHideDetectedField: this.hideDetectedField })),
                React.createElement(LogsNavigation, { logsSortOrder: logsSortOrder, visibleRange: visibleRange !== null && visibleRange !== void 0 ? visibleRange : absoluteRange, absoluteRange: absoluteRange, timeZone: timeZone, onChangeTime: onChangeTime, loading: loading, queries: logsQueries !== null && logsQueries !== void 0 ? logsQueries : [], scrollToTopLogs: this.scrollToTopLogs, addResultsToCache: addResultsToCache, clearCache: clearCache })),
            !loading && !hasData && !scanning && (React.createElement("div", { className: styles.noData },
                "No logs found.",
                React.createElement(Button, { size: "xs", fill: "text", onClick: this.onClickScan }, "Scan for older logs"))),
            scanning && (React.createElement("div", { className: styles.noData },
                React.createElement("span", null, scanText),
                React.createElement(Button, { size: "xs", fill: "text", onClick: this.onClickStopScan }, "Stop scan")))));
    };
    return UnthemedLogs;
}(PureComponent));
export var Logs = withTheme2(UnthemedLogs);
var getStyles = function (theme, wrapLogMessage) {
    return {
        noData: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      > * {\n        margin-left: 0.5em;\n      }\n    "], ["\n      > * {\n        margin-left: 0.5em;\n      }\n    "]))),
        logOptions: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n      display: flex;\n      justify-content: space-between;\n      align-items: baseline;\n      flex-wrap: wrap;\n      background-color: ", ";\n      padding: ", ";\n      border-radius: ", ";\n      margin: ", ";\n      border: 1px solid ", ";\n    "], ["\n      display: flex;\n      justify-content: space-between;\n      align-items: baseline;\n      flex-wrap: wrap;\n      background-color: ", ";\n      padding: ", ";\n      border-radius: ", ";\n      margin: ", ";\n      border: 1px solid ", ";\n    "])), theme.colors.background.primary, theme.spacing(1, 2), theme.shape.borderRadius(), theme.spacing(2, 0, 1), theme.colors.border.medium),
        headerButton: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n      margin: ", ";\n    "], ["\n      margin: ", ";\n    "])), theme.spacing(0.5, 0, 0, 1)),
        radioButtons: css(templateObject_4 || (templateObject_4 = __makeTemplateObject(["\n      margin: 0 ", ";\n    "], ["\n      margin: 0 ", ";\n    "])), theme.spacing(1)),
        logsSection: css(templateObject_5 || (templateObject_5 = __makeTemplateObject(["\n      display: flex;\n      flex-direction: row;\n      justify-content: space-between;\n    "], ["\n      display: flex;\n      flex-direction: row;\n      justify-content: space-between;\n    "]))),
        logRows: css(templateObject_6 || (templateObject_6 = __makeTemplateObject(["\n      overflow-x: ", ";\n      overflow-y: visible;\n      width: 100%;\n    "], ["\n      overflow-x: ", ";\n      overflow-y: visible;\n      width: 100%;\n    "])), wrapLogMessage ? 'unset' : 'scroll'),
        infoText: css(templateObject_7 || (templateObject_7 = __makeTemplateObject(["\n      font-size: ", ";\n      color: ", ";\n    "], ["\n      font-size: ", ";\n      color: ", ";\n    "])), theme.typography.size.sm, theme.colors.text.secondary),
    };
};
var templateObject_1, templateObject_2, templateObject_3, templateObject_4, templateObject_5, templateObject_6, templateObject_7;
//# sourceMappingURL=Logs.js.map