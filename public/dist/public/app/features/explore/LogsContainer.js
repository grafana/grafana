import { __awaiter, __extends, __generator, __makeTemplateObject } from "tslib";
import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import { css } from 'emotion';
import { Collapse } from '@grafana/ui';
import { hasLogsContextSupport, hasLogsVolumeSupport, } from '@grafana/data';
import { splitOpen } from './state/main';
import { addResultsToCache, clearCache, loadLogsVolumeData } from './state/query';
import { updateTimeRange } from './state/time';
import { getTimeZone } from '../profile/state/selectors';
import { LiveLogsWithTheme } from './LiveLogs';
import { Logs } from './Logs';
import { LogsCrossFadeTransition } from './utils/LogsCrossFadeTransition';
import { LiveTailControls } from './useLiveTailControls';
import { getFieldLinksForExplore } from './utils/links';
import { config } from 'app/core/config';
var LogsContainer = /** @class */ (function (_super) {
    __extends(LogsContainer, _super);
    function LogsContainer() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.onChangeTime = function (absoluteRange) {
            var _a = _this.props, exploreId = _a.exploreId, updateTimeRange = _a.updateTimeRange;
            updateTimeRange({ exploreId: exploreId, absoluteRange: absoluteRange });
        };
        _this.getLogRowContext = function (row, options) { return __awaiter(_this, void 0, void 0, function () {
            var datasourceInstance;
            return __generator(this, function (_a) {
                datasourceInstance = this.props.datasourceInstance;
                if (hasLogsContextSupport(datasourceInstance)) {
                    return [2 /*return*/, datasourceInstance.getLogRowContext(row, options)];
                }
                return [2 /*return*/, []];
            });
        }); };
        _this.showContextToggle = function (row) {
            var datasourceInstance = _this.props.datasourceInstance;
            if (hasLogsContextSupport(datasourceInstance)) {
                return datasourceInstance.showContextToggle(row);
            }
            return false;
        };
        _this.getFieldLinks = function (field, rowIndex) {
            var _a = _this.props, splitOpenFn = _a.splitOpen, range = _a.range;
            return getFieldLinksForExplore({ field: field, rowIndex: rowIndex, splitOpenFn: splitOpenFn, range: range });
        };
        return _this;
    }
    LogsContainer.prototype.render = function () {
        var _this = this;
        var _a = this.props, datasourceInstance = _a.datasourceInstance, loading = _a.loading, loadingState = _a.loadingState, logRows = _a.logRows, logsMeta = _a.logsMeta, logsSeries = _a.logsSeries, logsQueries = _a.logsQueries, onClickFilterLabel = _a.onClickFilterLabel, onClickFilterOutLabel = _a.onClickFilterOutLabel, onStartScanning = _a.onStartScanning, onStopScanning = _a.onStopScanning, absoluteRange = _a.absoluteRange, timeZone = _a.timeZone, visibleRange = _a.visibleRange, scanning = _a.scanning, range = _a.range, width = _a.width, isLive = _a.isLive, exploreId = _a.exploreId, addResultsToCache = _a.addResultsToCache, clearCache = _a.clearCache, logsVolumeDataProvider = _a.logsVolumeDataProvider, loadLogsVolumeData = _a.loadLogsVolumeData;
        if (!logRows) {
            return null;
        }
        // We need to override css overflow of divs in Collapse element to enable sticky Logs navigation
        var styleOverridesForStickyNavigation = css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      & > div {\n        overflow: visible;\n        & > div {\n          overflow: visible;\n        }\n      }\n    "], ["\n      & > div {\n        overflow: visible;\n        & > div {\n          overflow: visible;\n        }\n      }\n    "])));
        return (React.createElement(React.Fragment, null,
            React.createElement(LogsCrossFadeTransition, { visible: isLive },
                React.createElement(Collapse, { label: "Logs", loading: false, isOpen: true },
                    React.createElement(LiveTailControls, { exploreId: exploreId }, function (controls) { return (React.createElement(LiveLogsWithTheme, { logRows: logRows, timeZone: timeZone, stopLive: controls.stop, isPaused: _this.props.isPaused, onPause: controls.pause, onResume: controls.resume })); }))),
            React.createElement(LogsCrossFadeTransition, { visible: !isLive },
                React.createElement(Collapse, { label: "Logs", loading: loading, isOpen: true, className: styleOverridesForStickyNavigation },
                    React.createElement(Logs, { logRows: logRows, logsMeta: logsMeta, logsSeries: logsSeries, logsQueries: logsQueries, width: width, loading: loading, loadingState: loadingState, onChangeTime: this.onChangeTime, onClickFilterLabel: onClickFilterLabel, onClickFilterOutLabel: onClickFilterOutLabel, onStartScanning: onStartScanning, onStopScanning: onStopScanning, absoluteRange: absoluteRange, visibleRange: visibleRange, timeZone: timeZone, scanning: scanning, scanRange: range.raw, showContextToggle: this.showContextToggle, getRowContext: this.getLogRowContext, getFieldLinks: this.getFieldLinks, addResultsToCache: function () { return addResultsToCache(exploreId); }, clearCache: function () { return clearCache(exploreId); }, loadingLogsVolumeAvailable: hasLogsVolumeSupport(datasourceInstance) &&
                            !!logsVolumeDataProvider &&
                            !config.featureToggles.autoLoadFullRangeLogsVolume, onClickLoadLogsVolume: function () { return loadLogsVolumeData(exploreId); } })))));
    };
    return LogsContainer;
}(PureComponent));
function mapStateToProps(state, _a) {
    var exploreId = _a.exploreId;
    var explore = state.explore;
    // @ts-ignore
    var item = explore[exploreId];
    var logsResult = item.logsResult, loading = item.loading, scanning = item.scanning, datasourceInstance = item.datasourceInstance, isLive = item.isLive, isPaused = item.isPaused, range = item.range, absoluteRange = item.absoluteRange, logsVolumeDataProvider = item.logsVolumeDataProvider, logsVolumeData = item.logsVolumeData;
    var timeZone = getTimeZone(state.user);
    return {
        loading: loading,
        logRows: logsResult === null || logsResult === void 0 ? void 0 : logsResult.rows,
        logsMeta: logsResult === null || logsResult === void 0 ? void 0 : logsResult.meta,
        logsSeries: logsResult === null || logsResult === void 0 ? void 0 : logsResult.series,
        logsQueries: logsResult === null || logsResult === void 0 ? void 0 : logsResult.queries,
        visibleRange: logsResult === null || logsResult === void 0 ? void 0 : logsResult.visibleRange,
        scanning: scanning,
        timeZone: timeZone,
        datasourceInstance: datasourceInstance,
        isLive: isLive,
        isPaused: isPaused,
        range: range,
        absoluteRange: absoluteRange,
        logsVolumeDataProvider: logsVolumeDataProvider,
        logsVolumeData: logsVolumeData,
    };
}
var mapDispatchToProps = {
    updateTimeRange: updateTimeRange,
    splitOpen: splitOpen,
    addResultsToCache: addResultsToCache,
    clearCache: clearCache,
    loadLogsVolumeData: loadLogsVolumeData,
};
var connector = connect(mapStateToProps, mapDispatchToProps);
export default connector(LogsContainer);
var templateObject_1;
//# sourceMappingURL=LogsContainer.js.map