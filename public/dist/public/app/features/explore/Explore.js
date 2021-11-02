import { __extends, __makeTemplateObject } from "tslib";
import React from 'react';
import { css, cx } from '@emotion/css';
import { compose } from 'redux';
import { connect } from 'react-redux';
import AutoSizer from 'react-virtualized-auto-sizer';
import memoizeOne from 'memoize-one';
import { selectors } from '@grafana/e2e-selectors';
import { Collapse, CustomScrollbar, ErrorBoundaryAlert, withTheme2 } from '@grafana/ui';
import { LoadingState } from '@grafana/data';
import LogsContainer from './LogsContainer';
import { QueryRows } from './QueryRows';
import TableContainer from './TableContainer';
import RichHistoryContainer from './RichHistory/RichHistoryContainer';
import ExploreQueryInspector from './ExploreQueryInspector';
import { splitOpen } from './state/main';
import { changeSize, changeGraphStyle } from './state/explorePane';
import { updateTimeRange } from './state/time';
import { addQueryRow, loadLogsVolumeData, modifyQueries, scanStart, scanStopAction, setQueries } from './state/query';
import { ExploreToolbar } from './ExploreToolbar';
import { NoDataSourceCallToAction } from './NoDataSourceCallToAction';
import { getTimeZone } from '../profile/state/selectors';
import { SecondaryActions } from './SecondaryActions';
import { FILTER_FOR_OPERATOR, FILTER_OUT_OPERATOR } from '@grafana/ui/src/components/Table/types';
import { NodeGraphContainer } from './NodeGraphContainer';
import { ResponseErrorContainer } from './ResponseErrorContainer';
import { TraceViewContainer } from './TraceView/TraceViewContainer';
import { ExploreGraph } from './ExploreGraph';
import { LogsVolumePanel } from './LogsVolumePanel';
import { ExploreGraphLabel } from './ExploreGraphLabel';
var getStyles = function (theme) {
    return {
        exploreMain: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      label: exploreMain;\n      // Is needed for some transition animations to work.\n      position: relative;\n      margin-top: 21px;\n    "], ["\n      label: exploreMain;\n      // Is needed for some transition animations to work.\n      position: relative;\n      margin-top: 21px;\n    "]))),
        button: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n      label: button;\n      margin: 1em 4px 0 0;\n    "], ["\n      label: button;\n      margin: 1em 4px 0 0;\n    "]))),
        queryContainer: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n      label: queryContainer;\n      // Need to override normal css class and don't want to count on ordering of the classes in html.\n      height: auto !important;\n      flex: unset !important;\n      display: unset !important;\n      padding: ", ";\n    "], ["\n      label: queryContainer;\n      // Need to override normal css class and don't want to count on ordering of the classes in html.\n      height: auto !important;\n      flex: unset !important;\n      display: unset !important;\n      padding: ", ";\n    "])), theme.spacing(1)),
    };
};
var ExploreDrawer;
(function (ExploreDrawer) {
    ExploreDrawer[ExploreDrawer["RichHistory"] = 0] = "RichHistory";
    ExploreDrawer[ExploreDrawer["QueryInspector"] = 1] = "QueryInspector";
})(ExploreDrawer || (ExploreDrawer = {}));
/**
 * Explore provides an area for quick query iteration for a given datasource.
 * Once a datasource is selected it populates the query section at the top.
 * When queries are run, their results are being displayed in the main section.
 * The datasource determines what kind of query editor it brings, and what kind
 * of results viewers it supports. The state is managed entirely in Redux.
 *
 * SPLIT VIEW
 *
 * Explore can have two Explore areas side-by-side. This is handled in `Wrapper.tsx`.
 * Since there can be multiple Explores (e.g., left and right) each action needs
 * the `exploreId` as first parameter so that the reducer knows which Explore state
 * is affected.
 *
 * DATASOURCE REQUESTS
 *
 * A click on Run Query creates transactions for all DataQueries for all expanded
 * result viewers. New runs are discarding previous runs. Upon completion a transaction
 * saves the result. The result viewers construct their data from the currently existing
 * transactions.
 *
 * The result viewers determine some of the query options sent to the datasource, e.g.,
 * `format`, to indicate eventual transformations by the datasources' result transformers.
 */
var Explore = /** @class */ (function (_super) {
    __extends(Explore, _super);
    function Explore(props) {
        var _this = _super.call(this, props) || this;
        _this.onChangeTime = function (rawRange) {
            var _a = _this.props, updateTimeRange = _a.updateTimeRange, exploreId = _a.exploreId;
            updateTimeRange({ exploreId: exploreId, rawRange: rawRange });
        };
        // Use this in help pages to set page to a single query
        _this.onClickExample = function (query) {
            _this.props.setQueries(_this.props.exploreId, [query]);
        };
        _this.onCellFilterAdded = function (filter) {
            var value = filter.value, key = filter.key, operator = filter.operator;
            if (operator === FILTER_FOR_OPERATOR) {
                _this.onClickFilterLabel(key, value);
            }
            if (operator === FILTER_OUT_OPERATOR) {
                _this.onClickFilterOutLabel(key, value);
            }
        };
        _this.onClickFilterLabel = function (key, value) {
            _this.onModifyQueries({ type: 'ADD_FILTER', key: key, value: value });
        };
        _this.onClickFilterOutLabel = function (key, value) {
            _this.onModifyQueries({ type: 'ADD_FILTER_OUT', key: key, value: value });
        };
        _this.onClickAddQueryRowButton = function () {
            var _a = _this.props, exploreId = _a.exploreId, queryKeys = _a.queryKeys;
            _this.props.addQueryRow(exploreId, queryKeys.length);
        };
        _this.onModifyQueries = function (action, index) {
            var datasourceInstance = _this.props.datasourceInstance;
            if (datasourceInstance === null || datasourceInstance === void 0 ? void 0 : datasourceInstance.modifyQuery) {
                var modifier = function (queries, modification) {
                    return datasourceInstance.modifyQuery(queries, modification);
                };
                _this.props.modifyQueries(_this.props.exploreId, action, modifier, index);
            }
        };
        _this.onResize = function (size) {
            _this.props.changeSize(_this.props.exploreId, size);
        };
        _this.onStartScanning = function () {
            // Scanner will trigger a query
            _this.props.scanStart(_this.props.exploreId);
        };
        _this.onStopScanning = function () {
            _this.props.scanStopAction({ exploreId: _this.props.exploreId });
        };
        _this.onUpdateTimeRange = function (absoluteRange) {
            var _a = _this.props, exploreId = _a.exploreId, updateTimeRange = _a.updateTimeRange;
            updateTimeRange({ exploreId: exploreId, absoluteRange: absoluteRange });
        };
        _this.onChangeGraphStyle = function (graphStyle) {
            var _a = _this.props, exploreId = _a.exploreId, changeGraphStyle = _a.changeGraphStyle;
            changeGraphStyle(exploreId, graphStyle);
        };
        _this.toggleShowRichHistory = function () {
            _this.setState(function (state) {
                return {
                    openDrawer: state.openDrawer === ExploreDrawer.RichHistory ? undefined : ExploreDrawer.RichHistory,
                };
            });
        };
        _this.toggleShowQueryInspector = function () {
            _this.setState(function (state) {
                return {
                    openDrawer: state.openDrawer === ExploreDrawer.QueryInspector ? undefined : ExploreDrawer.QueryInspector,
                };
            });
        };
        _this.getNodeGraphDataFrames = memoizeOne(function (frames) {
            // TODO: this not in sync with how other types of responses are handled. Other types have a query response
            //  processing pipeline which ends up populating redux state with proper data. As we move towards more dataFrame
            //  oriented API it seems like a better direction to move such processing into to visualisations and do minimal
            //  and lazy processing here. Needs bigger refactor so keeping nodeGraph and Traces as they are for now.
            return frames.filter(function (frame) { var _a; return ((_a = frame.meta) === null || _a === void 0 ? void 0 : _a.preferredVisualisationType) === 'nodeGraph'; });
        });
        _this.state = {
            openDrawer: undefined,
        };
        return _this;
    }
    Explore.prototype.renderEmptyState = function () {
        return (React.createElement("div", { className: "explore-container" },
            React.createElement(NoDataSourceCallToAction, null)));
    };
    Explore.prototype.renderGraphPanel = function (width) {
        var _a = this.props, graphResult = _a.graphResult, absoluteRange = _a.absoluteRange, timeZone = _a.timeZone, splitOpen = _a.splitOpen, queryResponse = _a.queryResponse, loading = _a.loading, theme = _a.theme, graphStyle = _a.graphStyle;
        var spacing = parseInt(theme.spacing(2).slice(0, -2), 10);
        var label = React.createElement(ExploreGraphLabel, { graphStyle: graphStyle, onChangeGraphStyle: this.onChangeGraphStyle });
        return (React.createElement(Collapse, { label: label, loading: loading, isOpen: true },
            React.createElement(ExploreGraph, { graphStyle: graphStyle, data: graphResult, height: 400, width: width - spacing, absoluteRange: absoluteRange, onChangeTime: this.onUpdateTimeRange, timeZone: timeZone, annotations: queryResponse.annotations, splitOpenFn: splitOpen, loadingState: queryResponse.state })));
    };
    Explore.prototype.renderLogsVolume = function (width) {
        var _a = this.props, logsVolumeData = _a.logsVolumeData, exploreId = _a.exploreId, loadLogsVolumeData = _a.loadLogsVolumeData, absoluteRange = _a.absoluteRange, timeZone = _a.timeZone, splitOpen = _a.splitOpen;
        return (React.createElement(LogsVolumePanel, { absoluteRange: absoluteRange, width: width, logsVolumeData: logsVolumeData, onUpdateTimeRange: this.onUpdateTimeRange, timeZone: timeZone, splitOpen: splitOpen, onLoadLogsVolume: function () { return loadLogsVolumeData(exploreId); } }));
    };
    Explore.prototype.renderTablePanel = function (width) {
        var _a = this.props, exploreId = _a.exploreId, datasourceInstance = _a.datasourceInstance;
        return (React.createElement(TableContainer, { ariaLabel: selectors.pages.Explore.General.table, width: width, exploreId: exploreId, onCellFilterAdded: (datasourceInstance === null || datasourceInstance === void 0 ? void 0 : datasourceInstance.modifyQuery) ? this.onCellFilterAdded : undefined }));
    };
    Explore.prototype.renderLogsPanel = function (width) {
        var _a = this.props, exploreId = _a.exploreId, syncedTimes = _a.syncedTimes, theme = _a.theme, queryResponse = _a.queryResponse;
        var spacing = parseInt(theme.spacing(2).slice(0, -2), 10);
        return (React.createElement(LogsContainer, { exploreId: exploreId, loadingState: queryResponse.state, syncedTimes: syncedTimes, width: width - spacing, onClickFilterLabel: this.onClickFilterLabel, onClickFilterOutLabel: this.onClickFilterOutLabel, onStartScanning: this.onStartScanning, onStopScanning: this.onStopScanning }));
    };
    Explore.prototype.renderNodeGraphPanel = function () {
        var _a = this.props, exploreId = _a.exploreId, showTrace = _a.showTrace, queryResponse = _a.queryResponse;
        return (React.createElement(NodeGraphContainer, { dataFrames: this.getNodeGraphDataFrames(queryResponse.series), exploreId: exploreId, withTraceView: showTrace }));
    };
    Explore.prototype.renderTraceViewPanel = function () {
        var _a = this.props, queryResponse = _a.queryResponse, splitOpen = _a.splitOpen, exploreId = _a.exploreId;
        var dataFrames = queryResponse.series.filter(function (series) { var _a; return ((_a = series.meta) === null || _a === void 0 ? void 0 : _a.preferredVisualisationType) === 'trace'; });
        return (
        // If there is no data (like 404) we show a separate error so no need to show anything here
        dataFrames.length && React.createElement(TraceViewContainer, { exploreId: exploreId, dataFrames: dataFrames, splitOpenFn: splitOpen }));
    };
    Explore.prototype.render = function () {
        var _this = this;
        var _a = this.props, datasourceInstance = _a.datasourceInstance, datasourceMissing = _a.datasourceMissing, exploreId = _a.exploreId, graphResult = _a.graphResult, queryResponse = _a.queryResponse, isLive = _a.isLive, theme = _a.theme, showMetrics = _a.showMetrics, showTable = _a.showTable, showLogs = _a.showLogs, showTrace = _a.showTrace, showNodeGraph = _a.showNodeGraph;
        var openDrawer = this.state.openDrawer;
        var styles = getStyles(theme);
        var showPanels = queryResponse && queryResponse.state !== LoadingState.NotStarted;
        var showRichHistory = openDrawer === ExploreDrawer.RichHistory;
        var showQueryInspector = openDrawer === ExploreDrawer.QueryInspector;
        return (React.createElement(CustomScrollbar, { autoHeightMin: '100%' },
            React.createElement(ExploreToolbar, { exploreId: exploreId, onChangeTime: this.onChangeTime }),
            datasourceMissing ? this.renderEmptyState() : null,
            datasourceInstance && (React.createElement("div", { className: "explore-container" },
                React.createElement("div", { className: cx('panel-container', styles.queryContainer) },
                    React.createElement(QueryRows, { exploreId: exploreId }),
                    React.createElement(SecondaryActions, { addQueryRowButtonDisabled: isLive, 
                        // We cannot show multiple traces at the same time right now so we do not show add query button.
                        //TODO:unification
                        addQueryRowButtonHidden: false, richHistoryButtonActive: showRichHistory, queryInspectorButtonActive: showQueryInspector, onClickAddQueryRowButton: this.onClickAddQueryRowButton, onClickRichHistoryButton: this.toggleShowRichHistory, onClickQueryInspectorButton: this.toggleShowQueryInspector }),
                    React.createElement(ResponseErrorContainer, { exploreId: exploreId })),
                React.createElement(AutoSizer, { onResize: this.onResize, disableHeight: true }, function (_a) {
                    var width = _a.width;
                    if (width === 0) {
                        return null;
                    }
                    return (React.createElement("main", { className: cx(styles.exploreMain), style: { width: width } },
                        React.createElement(ErrorBoundaryAlert, null,
                            showPanels && (React.createElement(React.Fragment, null,
                                showMetrics && graphResult && (React.createElement(ErrorBoundaryAlert, null, _this.renderGraphPanel(width))),
                                React.createElement(ErrorBoundaryAlert, null, _this.renderLogsVolume(width)),
                                showTable && React.createElement(ErrorBoundaryAlert, null, _this.renderTablePanel(width)),
                                showLogs && React.createElement(ErrorBoundaryAlert, null, _this.renderLogsPanel(width)),
                                showNodeGraph && React.createElement(ErrorBoundaryAlert, null, _this.renderNodeGraphPanel()),
                                showTrace && React.createElement(ErrorBoundaryAlert, null, _this.renderTraceViewPanel()))),
                            showRichHistory && (React.createElement(RichHistoryContainer, { width: width, exploreId: exploreId, onClose: _this.toggleShowRichHistory })),
                            showQueryInspector && (React.createElement(ExploreQueryInspector, { exploreId: exploreId, width: width, onClose: _this.toggleShowQueryInspector })))));
                })))));
    };
    return Explore;
}(React.PureComponent));
export { Explore };
function mapStateToProps(state, _a) {
    var exploreId = _a.exploreId;
    var explore = state.explore;
    var syncedTimes = explore.syncedTimes;
    var item = explore[exploreId];
    var timeZone = getTimeZone(state.user);
    var datasourceInstance = item.datasourceInstance, datasourceMissing = item.datasourceMissing, queryKeys = item.queryKeys, isLive = item.isLive, graphResult = item.graphResult, logsVolumeData = item.logsVolumeData, logsResult = item.logsResult, showLogs = item.showLogs, showMetrics = item.showMetrics, showTable = item.showTable, showTrace = item.showTrace, absoluteRange = item.absoluteRange, queryResponse = item.queryResponse, showNodeGraph = item.showNodeGraph, loading = item.loading, graphStyle = item.graphStyle;
    return {
        datasourceInstance: datasourceInstance,
        datasourceMissing: datasourceMissing,
        queryKeys: queryKeys,
        isLive: isLive,
        graphResult: graphResult,
        logsVolumeData: logsVolumeData,
        logsResult: logsResult !== null && logsResult !== void 0 ? logsResult : undefined,
        absoluteRange: absoluteRange,
        queryResponse: queryResponse,
        syncedTimes: syncedTimes,
        timeZone: timeZone,
        showLogs: showLogs,
        showMetrics: showMetrics,
        showTable: showTable,
        showTrace: showTrace,
        showNodeGraph: showNodeGraph,
        loading: loading,
        graphStyle: graphStyle,
    };
}
var mapDispatchToProps = {
    changeSize: changeSize,
    changeGraphStyle: changeGraphStyle,
    modifyQueries: modifyQueries,
    scanStart: scanStart,
    scanStopAction: scanStopAction,
    setQueries: setQueries,
    updateTimeRange: updateTimeRange,
    loadLogsVolumeData: loadLogsVolumeData,
    addQueryRow: addQueryRow,
    splitOpen: splitOpen,
};
var connector = connect(mapStateToProps, mapDispatchToProps);
export default compose(connector, withTheme2)(Explore);
var templateObject_1, templateObject_2, templateObject_3;
//# sourceMappingURL=Explore.js.map