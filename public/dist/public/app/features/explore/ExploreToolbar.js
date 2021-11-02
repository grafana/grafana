import { __awaiter, __extends, __generator, __makeTemplateObject } from "tslib";
import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import classNames from 'classnames';
import { css } from '@emotion/css';
import { Icon, IconButton, SetInterval, ToolbarButton, ToolbarButtonRow, Tooltip } from '@grafana/ui';
import { DataSourcePicker } from '@grafana/runtime';
import { createAndCopyShortLink } from 'app/core/utils/shortLinks';
import { changeDatasource } from './state/datasource';
import { splitClose, splitOpen } from './state/main';
import { syncTimes, changeRefreshInterval } from './state/time';
import { getFiscalYearStartMonth, getTimeZone } from '../profile/state/selectors';
import { updateFiscalYearStartMonthForSession, updateTimeZoneForSession } from '../profile/state/reducers';
import { ExploreTimeControls } from './ExploreTimeControls';
import { LiveTailButton } from './LiveTailButton';
import { RunButton } from './RunButton';
import { LiveTailControls } from './useLiveTailControls';
import { cancelQueries, clearQueries, runQueries } from './state/query';
import ReturnToDashboardButton from './ReturnToDashboardButton';
import { isSplit } from './state/selectors';
var UnConnectedExploreToolbar = /** @class */ (function (_super) {
    __extends(UnConnectedExploreToolbar, _super);
    function UnConnectedExploreToolbar() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.onChangeDatasource = function (dsSettings) { return __awaiter(_this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                this.props.changeDatasource(this.props.exploreId, dsSettings.uid, { importQueries: true });
                return [2 /*return*/];
            });
        }); };
        _this.onClearAll = function () {
            _this.props.clearAll(_this.props.exploreId);
        };
        _this.onRunQuery = function (loading) {
            if (loading === void 0) { loading = false; }
            var _a = _this.props, runQueries = _a.runQueries, cancelQueries = _a.cancelQueries, exploreId = _a.exploreId;
            if (loading) {
                return cancelQueries(exploreId);
            }
            else {
                return runQueries(exploreId);
            }
        };
        _this.onChangeRefreshInterval = function (item) {
            var _a = _this.props, changeRefreshInterval = _a.changeRefreshInterval, exploreId = _a.exploreId;
            changeRefreshInterval(exploreId, item);
        };
        _this.onChangeTimeSync = function () {
            var _a = _this.props, syncTimes = _a.syncTimes, exploreId = _a.exploreId;
            syncTimes(exploreId);
        };
        return _this;
    }
    UnConnectedExploreToolbar.prototype.render = function () {
        var _a = this.props, datasourceMissing = _a.datasourceMissing, closeSplit = _a.closeSplit, exploreId = _a.exploreId, loading = _a.loading, range = _a.range, timeZone = _a.timeZone, fiscalYearStartMonth = _a.fiscalYearStartMonth, splitted = _a.splitted, syncedTimes = _a.syncedTimes, refreshInterval = _a.refreshInterval, onChangeTime = _a.onChangeTime, split = _a.split, hasLiveOption = _a.hasLiveOption, isLive = _a.isLive, isPaused = _a.isPaused, containerWidth = _a.containerWidth, onChangeTimeZone = _a.onChangeTimeZone, onChangeFiscalYearStartMonth = _a.onChangeFiscalYearStartMonth;
        var showSmallDataSourcePicker = (splitted ? containerWidth < 700 : containerWidth < 800) || false;
        var showSmallTimePicker = splitted || containerWidth < 1210;
        return (React.createElement("div", { className: splitted ? 'explore-toolbar splitted' : 'explore-toolbar' },
            React.createElement("div", { className: "explore-toolbar-item" },
                React.createElement("div", { className: "explore-toolbar-header" },
                    React.createElement("div", { className: "explore-toolbar-header-title" }, exploreId === 'left' && (React.createElement("span", { className: "navbar-page-btn" },
                        React.createElement(Icon, { name: "compass", size: "lg", className: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n                      margin-right: 6px;\n                      margin-bottom: 3px;\n                    "], ["\n                      margin-right: 6px;\n                      margin-bottom: 3px;\n                    "]))) }),
                        "Explore"))),
                    splitted && (React.createElement(IconButton, { title: "Close split pane", className: "explore-toolbar-header-close", onClick: function () { return closeSplit(exploreId); }, name: "times" })))),
            React.createElement("div", { className: "explore-toolbar-item" },
                React.createElement("div", { className: "explore-toolbar-content" },
                    !datasourceMissing ? (React.createElement("div", { className: "explore-toolbar-content-item" },
                        React.createElement("div", { className: classNames('explore-ds-picker', showSmallDataSourcePicker ? 'explore-ds-picker--small' : '') },
                            React.createElement(DataSourcePicker, { onChange: this.onChangeDatasource, current: this.props.datasourceName, hideTextValue: showSmallDataSourcePicker })))) : null,
                    React.createElement(ToolbarButtonRow, null,
                        React.createElement(ReturnToDashboardButton, { exploreId: exploreId }),
                        exploreId === 'left' && !splitted ? (React.createElement(ToolbarButton, { iconOnly: splitted, title: "Split", 
                            /* This way ToolbarButton doesn't add event as a parameter when invoking split function
                             * which breaks splitting functionality
                             */
                            onClick: function () { return split(); }, icon: "columns", disabled: isLive }, "Split")) : null,
                        React.createElement(Tooltip, { content: 'Copy shortened link to the executed query', placement: "bottom" },
                            React.createElement(ToolbarButton, { icon: "share-alt", onClick: function () { return createAndCopyShortLink(window.location.href); }, "aria-label": "Copy shortened link to the executed query" })),
                        !isLive && (React.createElement(ExploreTimeControls, { exploreId: exploreId, range: range, timeZone: timeZone, fiscalYearStartMonth: fiscalYearStartMonth, onChangeTime: onChangeTime, splitted: splitted, syncedTimes: syncedTimes, onChangeTimeSync: this.onChangeTimeSync, hideText: showSmallTimePicker, onChangeTimeZone: onChangeTimeZone, onChangeFiscalYearStartMonth: onChangeFiscalYearStartMonth })),
                        !isLive && (React.createElement(ToolbarButton, { title: "Clear all", onClick: this.onClearAll, icon: "trash-alt", iconOnly: splitted }, "Clear all")),
                        React.createElement(RunButton, { refreshInterval: refreshInterval, onChangeRefreshInterval: this.onChangeRefreshInterval, isSmall: splitted || showSmallTimePicker, isLive: isLive, loading: loading || (isLive && !isPaused), onRun: this.onRunQuery, showDropdown: !isLive }),
                        refreshInterval && React.createElement(SetInterval, { func: this.onRunQuery, interval: refreshInterval, loading: loading }),
                        hasLiveOption && (React.createElement(LiveTailControls, { exploreId: exploreId }, function (controls) { return (React.createElement(LiveTailButton, { splitted: splitted, isLive: isLive, isPaused: isPaused, start: controls.start, pause: controls.pause, resume: controls.resume, stop: controls.stop })); })))))));
    };
    return UnConnectedExploreToolbar;
}(PureComponent));
var mapStateToProps = function (state, _a) {
    var _b;
    var exploreId = _a.exploreId;
    var syncedTimes = state.explore.syncedTimes;
    var exploreItem = state.explore[exploreId];
    var datasourceInstance = exploreItem.datasourceInstance, datasourceMissing = exploreItem.datasourceMissing, range = exploreItem.range, refreshInterval = exploreItem.refreshInterval, loading = exploreItem.loading, isLive = exploreItem.isLive, isPaused = exploreItem.isPaused, containerWidth = exploreItem.containerWidth;
    var hasLiveOption = !!((_b = datasourceInstance === null || datasourceInstance === void 0 ? void 0 : datasourceInstance.meta) === null || _b === void 0 ? void 0 : _b.streaming);
    return {
        datasourceMissing: datasourceMissing,
        datasourceName: datasourceInstance === null || datasourceInstance === void 0 ? void 0 : datasourceInstance.name,
        loading: loading,
        range: range,
        timeZone: getTimeZone(state.user),
        fiscalYearStartMonth: getFiscalYearStartMonth(state.user),
        splitted: isSplit(state),
        refreshInterval: refreshInterval,
        hasLiveOption: hasLiveOption,
        isLive: isLive,
        isPaused: isPaused,
        syncedTimes: syncedTimes,
        containerWidth: containerWidth,
    };
};
var mapDispatchToProps = {
    changeDatasource: changeDatasource,
    changeRefreshInterval: changeRefreshInterval,
    clearAll: clearQueries,
    cancelQueries: cancelQueries,
    runQueries: runQueries,
    closeSplit: splitClose,
    split: splitOpen,
    syncTimes: syncTimes,
    onChangeTimeZone: updateTimeZoneForSession,
    onChangeFiscalYearStartMonth: updateFiscalYearStartMonthForSession,
};
var connector = connect(mapStateToProps, mapDispatchToProps);
export var ExploreToolbar = connector(UnConnectedExploreToolbar);
var templateObject_1;
//# sourceMappingURL=ExploreToolbar.js.map