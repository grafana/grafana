import { __awaiter } from "tslib";
import { css, cx } from '@emotion/css';
import { get, groupBy } from 'lodash';
import memoizeOne from 'memoize-one';
import React, { createRef } from 'react';
import { connect } from 'react-redux';
import AutoSizer from 'react-virtualized-auto-sizer';
import { hasToggleableQueryFiltersSupport, LoadingState, SupplementaryQueryType, } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { config, getDataSourceSrv, reportInteraction } from '@grafana/runtime';
import { CustomScrollbar, ErrorBoundaryAlert, PanelContainer, withTheme2, } from '@grafana/ui';
import { FILTER_FOR_OPERATOR, FILTER_OUT_OPERATOR } from '@grafana/ui/src/components/Table/types';
import { supportedFeatures } from 'app/core/history/richHistoryStorageProvider';
import { MIXED_DATASOURCE_NAME } from 'app/plugins/datasource/mixed/MixedDataSource';
import { getNodeGraphDataFrames } from 'app/plugins/panel/nodeGraph/utils';
import { getTimeZone } from '../profile/state/selectors';
import { ContentOutline } from './ContentOutline/ContentOutline';
import { ContentOutlineContextProvider } from './ContentOutline/ContentOutlineContext';
import { ContentOutlineItem } from './ContentOutline/ContentOutlineItem';
import { CorrelationHelper } from './CorrelationHelper';
import { CustomContainer } from './CustomContainer';
import ExploreQueryInspector from './ExploreQueryInspector';
import { ExploreToolbar } from './ExploreToolbar';
import { FlameGraphExploreContainer } from './FlameGraph/FlameGraphExploreContainer';
import { GraphContainer } from './Graph/GraphContainer';
import LogsContainer from './Logs/LogsContainer';
import { LogsSamplePanel } from './Logs/LogsSamplePanel';
import { NoData } from './NoData';
import { NoDataSourceCallToAction } from './NoDataSourceCallToAction';
import { NodeGraphContainer } from './NodeGraph/NodeGraphContainer';
import { QueryRows } from './QueryRows';
import RawPrometheusContainer from './RawPrometheus/RawPrometheusContainer';
import { ResponseErrorContainer } from './ResponseErrorContainer';
import RichHistoryContainer from './RichHistory/RichHistoryContainer';
import { SecondaryActions } from './SecondaryActions';
import TableContainer from './Table/TableContainer';
import { TraceViewContainer } from './TraceView/TraceViewContainer';
import { changeSize } from './state/explorePane';
import { splitOpen } from './state/main';
import { addQueryRow, modifyQueries, scanStart, scanStopAction, selectIsWaitingForData, setQueries, setSupplementaryQueryEnabled, } from './state/query';
import { isSplit } from './state/selectors';
import { updateTimeRange } from './state/time';
const getStyles = (theme) => {
    return {
        exploreMain: css({
            label: 'exploreMain',
            // Is needed for some transition animations to work.
            position: 'relative',
            marginTop: '21px',
            display: 'flex',
            flexDirection: 'column',
            gap: theme.spacing(1),
        }),
        queryContainer: css({
            label: 'queryContainer',
            padding: theme.spacing(1),
        }),
        exploreContainer: css({
            label: 'exploreContainer',
            display: 'flex',
            flexDirection: 'column',
            paddingRight: theme.spacing(2),
            marginBottom: theme.spacing(2),
        }),
        left: css({
            marginBottom: theme.spacing(2),
        }),
        wrapper: css({
            position: 'absolute',
            top: 0,
            left: theme.spacing(2),
            right: 0,
            bottom: 0,
            display: 'flex',
        }),
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
export class Explore extends React.PureComponent {
    constructor(props) {
        super(props);
        this.topOfViewRef = createRef();
        this.memoizedGetNodeGraphDataFrames = memoizeOne(getNodeGraphDataFrames);
        this.onChangeTime = (rawRange) => {
            const { updateTimeRange, exploreId } = this.props;
            updateTimeRange({ exploreId, rawRange });
        };
        // Use this in help pages to set page to a single query
        this.onClickExample = (query) => {
            this.props.setQueries(this.props.exploreId, [query]);
        };
        this.onCellFilterAdded = (filter) => {
            const { value, key, operator } = filter;
            if (operator === FILTER_FOR_OPERATOR) {
                this.onClickFilterLabel(key, value);
            }
            if (operator === FILTER_OUT_OPERATOR) {
                this.onClickFilterOutLabel(key, value);
            }
        };
        this.onContentOutlineToogle = () => {
            this.setState((state) => {
                reportInteraction('explore_toolbar_contentoutline_clicked', {
                    item: 'outline',
                    type: state.contentOutlineVisible ? 'close' : 'open',
                });
                return {
                    contentOutlineVisible: !state.contentOutlineVisible,
                };
            });
        };
        /**
         * Used by Logs details.
         * Returns true if all queries have the filter, otherwise false.
         * TODO: In the future, we would like to return active filters based the query that produced the log line.
         * @alpha
         */
        this.isFilterLabelActive = (key, value, refId) => __awaiter(this, void 0, void 0, function* () {
            if (!config.featureToggles.toggleLabelsInLogsUI) {
                return false;
            }
            const query = this.props.queries.find((q) => q.refId === refId);
            if (!query) {
                return false;
            }
            const ds = yield getDataSourceSrv().get(query.datasource);
            if (hasToggleableQueryFiltersSupport(ds) && ds.queryHasFilter(query, { key, value })) {
                return true;
            }
            return false;
        });
        /**
         * Used by Logs details.
         */
        this.onClickFilterLabel = (key, value, refId) => {
            this.onModifyQueries({ type: 'ADD_FILTER', options: { key, value } }, refId);
        };
        /**
         * Used by Logs details.
         */
        this.onClickFilterOutLabel = (key, value, refId) => {
            this.onModifyQueries({ type: 'ADD_FILTER_OUT', options: { key, value } }, refId);
        };
        this.onClickAddQueryRowButton = () => {
            const { exploreId, queryKeys } = this.props;
            this.props.addQueryRow(exploreId, queryKeys.length);
        };
        /**
         * Used by Logs details.
         */
        this.onModifyQueries = (action, refId) => {
            const modifier = (query, modification) => __awaiter(this, void 0, void 0, function* () {
                var _a;
                // This gives Logs Details support to modify the query that produced the log line.
                // If not present, all queries are modified.
                if (refId && refId !== query.refId) {
                    return query;
                }
                const { datasource } = query;
                if (datasource == null) {
                    return query;
                }
                const ds = yield getDataSourceSrv().get(datasource);
                if (hasToggleableQueryFiltersSupport(ds) && config.featureToggles.toggleLabelsInLogsUI) {
                    return ds.toggleQueryFilter(query, {
                        type: modification.type === 'ADD_FILTER' ? 'FILTER_FOR' : 'FILTER_OUT',
                        options: (_a = modification.options) !== null && _a !== void 0 ? _a : {},
                    });
                }
                if (ds.modifyQuery) {
                    return ds.modifyQuery(query, modification);
                }
                else {
                    return query;
                }
            });
            this.props.modifyQueries(this.props.exploreId, action, modifier);
        };
        this.onResize = (size) => {
            this.props.changeSize(this.props.exploreId, size);
        };
        this.onStartScanning = () => {
            // Scanner will trigger a query
            this.props.scanStart(this.props.exploreId);
        };
        this.onStopScanning = () => {
            this.props.scanStopAction({ exploreId: this.props.exploreId });
        };
        this.onUpdateTimeRange = (absoluteRange) => {
            const { exploreId, updateTimeRange } = this.props;
            updateTimeRange({ exploreId, absoluteRange });
        };
        this.toggleShowRichHistory = () => {
            this.setState((state) => {
                return {
                    openDrawer: state.openDrawer === ExploreDrawer.RichHistory ? undefined : ExploreDrawer.RichHistory,
                };
            });
        };
        this.toggleShowQueryInspector = () => {
            this.setState((state) => {
                return {
                    openDrawer: state.openDrawer === ExploreDrawer.QueryInspector ? undefined : ExploreDrawer.QueryInspector,
                };
            });
        };
        this.onSplitOpen = (panelType) => {
            return (options) => __awaiter(this, void 0, void 0, function* () {
                this.props.splitOpen(options);
                if (options && this.props.datasourceInstance) {
                    const target = (yield getDataSourceSrv().get(options.datasourceUid)).type;
                    const source = this.props.datasourceInstance.uid === MIXED_DATASOURCE_NAME
                        ? get(this.props.queries, '0.datasource.type')
                        : this.props.datasourceInstance.type;
                    const tracking = {
                        origin: 'panel',
                        panelType,
                        source,
                        target,
                        exploreId: this.props.exploreId,
                    };
                    reportInteraction('grafana_explore_split_view_opened', tracking);
                }
            });
        };
        this.state = {
            openDrawer: undefined,
            contentOutlineVisible: false,
        };
        this.graphEventBus = props.eventBus.newScopedBus('graph', { onlyLocal: false });
        this.logsEventBus = props.eventBus.newScopedBus('logs', { onlyLocal: false });
    }
    renderEmptyState(exploreContainerStyles) {
        return (React.createElement("div", { className: cx(exploreContainerStyles) },
            React.createElement(NoDataSourceCallToAction, null)));
    }
    renderNoData() {
        return React.createElement(NoData, null);
    }
    renderCustom(width) {
        const { timeZone, queryResponse, absoluteRange, eventBus } = this.props;
        const groupedByPlugin = groupBy(queryResponse === null || queryResponse === void 0 ? void 0 : queryResponse.customFrames, 'meta.preferredVisualisationPluginId');
        return Object.entries(groupedByPlugin).map(([pluginId, frames], index) => {
            return (React.createElement(ContentOutlineItem, { title: pluginId, icon: "plug", key: index },
                React.createElement(CustomContainer, { key: index, timeZone: timeZone, pluginId: pluginId, frames: frames, state: queryResponse.state, absoluteRange: absoluteRange, height: 400, width: width, splitOpenFn: this.onSplitOpen(pluginId), eventBus: eventBus })));
        });
    }
    renderGraphPanel(width) {
        const { graphResult, absoluteRange, timeZone, queryResponse, showFlameGraph } = this.props;
        return (React.createElement(ContentOutlineItem, { title: "Graph", icon: "graph-bar" },
            React.createElement(GraphContainer, { data: graphResult, height: showFlameGraph ? 180 : 400, width: width, absoluteRange: absoluteRange, timeZone: timeZone, onChangeTime: this.onUpdateTimeRange, annotations: queryResponse.annotations, splitOpenFn: this.onSplitOpen('graph'), loadingState: queryResponse.state, eventBus: this.graphEventBus })));
    }
    renderTablePanel(width) {
        const { exploreId, timeZone } = this.props;
        return (React.createElement(ContentOutlineItem, { title: "Table", icon: "table" },
            React.createElement(TableContainer, { ariaLabel: selectors.pages.Explore.General.table, width: width, exploreId: exploreId, onCellFilterAdded: this.onCellFilterAdded, timeZone: timeZone, splitOpenFn: this.onSplitOpen('table') })));
    }
    renderRawPrometheus(width) {
        const { exploreId, datasourceInstance, timeZone } = this.props;
        return (React.createElement(ContentOutlineItem, { title: "Raw Prometheus", icon: "gf-prometheus" },
            React.createElement(RawPrometheusContainer, { showRawPrometheus: true, ariaLabel: selectors.pages.Explore.General.table, width: width, exploreId: exploreId, onCellFilterAdded: (datasourceInstance === null || datasourceInstance === void 0 ? void 0 : datasourceInstance.modifyQuery) ? this.onCellFilterAdded : undefined, timeZone: timeZone, splitOpenFn: this.onSplitOpen('table') })));
    }
    renderLogsPanel(width) {
        const { exploreId, syncedTimes, theme, queryResponse } = this.props;
        const spacing = parseInt(theme.spacing(2).slice(0, -2), 10);
        // Need to make ContentOutlineItem a flex container so the gap works
        const logsContentOutlineWrapper = css({
            display: 'flex',
            flexDirection: 'column',
            gap: theme.spacing(1),
        });
        return (React.createElement(ContentOutlineItem, { title: "Logs", icon: "gf-logs", className: logsContentOutlineWrapper },
            React.createElement(LogsContainer, { exploreId: exploreId, loadingState: queryResponse.state, syncedTimes: syncedTimes, width: width - spacing, onClickFilterLabel: this.onClickFilterLabel, onClickFilterOutLabel: this.onClickFilterOutLabel, onStartScanning: this.onStartScanning, onStopScanning: this.onStopScanning, eventBus: this.logsEventBus, splitOpenFn: this.onSplitOpen('logs'), scrollElement: this.scrollElement, isFilterLabelActive: this.isFilterLabelActive })));
    }
    renderLogsSamplePanel() {
        const { logsSample, timeZone, setSupplementaryQueryEnabled, exploreId, datasourceInstance, queries } = this.props;
        return (React.createElement(ContentOutlineItem, { title: "Logs Sample", icon: "gf-logs" },
            React.createElement(LogsSamplePanel, { queryResponse: logsSample.data, timeZone: timeZone, enabled: logsSample.enabled, queries: queries, datasourceInstance: datasourceInstance, splitOpen: this.onSplitOpen('logsSample'), setLogsSampleEnabled: (enabled) => setSupplementaryQueryEnabled(exploreId, enabled, SupplementaryQueryType.LogsSample) })));
    }
    renderNodeGraphPanel() {
        const { exploreId, showTrace, queryResponse, datasourceInstance } = this.props;
        const datasourceType = datasourceInstance ? datasourceInstance === null || datasourceInstance === void 0 ? void 0 : datasourceInstance.type : 'unknown';
        return (React.createElement(ContentOutlineItem, { title: "Node Graph", icon: "code-branch" },
            React.createElement(NodeGraphContainer, { dataFrames: this.memoizedGetNodeGraphDataFrames(queryResponse.series), exploreId: exploreId, withTraceView: showTrace, datasourceType: datasourceType, splitOpenFn: this.onSplitOpen('nodeGraph') })));
    }
    renderFlameGraphPanel() {
        const { queryResponse } = this.props;
        return (React.createElement(ContentOutlineItem, { title: "Flame Graph", icon: "fire" },
            React.createElement(FlameGraphExploreContainer, { dataFrames: queryResponse.flameGraphFrames })));
    }
    renderTraceViewPanel() {
        const { queryResponse, exploreId } = this.props;
        const dataFrames = queryResponse.series.filter((series) => { var _a; return ((_a = series.meta) === null || _a === void 0 ? void 0 : _a.preferredVisualisationType) === 'trace'; });
        return (
        // If there is no data (like 404) we show a separate error so no need to show anything here
        dataFrames.length && (React.createElement(ContentOutlineItem, { title: "Traces", icon: "file-alt" },
            React.createElement(TraceViewContainer, { exploreId: exploreId, dataFrames: dataFrames, splitOpenFn: this.onSplitOpen('traceView'), scrollElement: this.scrollElement, queryResponse: queryResponse, topOfViewRef: this.topOfViewRef }))));
    }
    render() {
        const { datasourceInstance, exploreId, graphResult, queryResponse, isLive, theme, showMetrics, showTable, showRawPrometheus, showLogs, showTrace, showCustom, showNodeGraph, showFlameGraph, timeZone, showLogsSample, correlationEditorDetails, correlationEditorHelperData, } = this.props;
        const { openDrawer, contentOutlineVisible } = this.state;
        const styles = getStyles(theme);
        const showPanels = queryResponse && queryResponse.state !== LoadingState.NotStarted;
        const showRichHistory = openDrawer === ExploreDrawer.RichHistory;
        const richHistoryRowButtonHidden = !supportedFeatures().queryHistoryAvailable;
        const showQueryInspector = openDrawer === ExploreDrawer.QueryInspector;
        const showNoData = queryResponse.state === LoadingState.Done &&
            [
                queryResponse.logsFrames,
                queryResponse.graphFrames,
                queryResponse.nodeGraphFrames,
                queryResponse.flameGraphFrames,
                queryResponse.tableFrames,
                queryResponse.rawPrometheusFrames,
                queryResponse.traceFrames,
                queryResponse.customFrames,
            ].every((e) => e.length === 0);
        let correlationsBox = undefined;
        const isCorrelationsEditorMode = correlationEditorDetails === null || correlationEditorDetails === void 0 ? void 0 : correlationEditorDetails.editorMode;
        const showCorrelationHelper = Boolean(isCorrelationsEditorMode || (correlationEditorDetails === null || correlationEditorDetails === void 0 ? void 0 : correlationEditorDetails.dirty));
        if (showCorrelationHelper && correlationEditorHelperData !== undefined) {
            correlationsBox = React.createElement(CorrelationHelper, { correlations: correlationEditorHelperData });
        }
        return (React.createElement(ContentOutlineContextProvider, null,
            React.createElement(ExploreToolbar, { exploreId: exploreId, onChangeTime: this.onChangeTime, onContentOutlineToogle: this.onContentOutlineToogle, isContentOutlineOpen: contentOutlineVisible }),
            React.createElement("div", { style: {
                    position: 'relative',
                    height: '100%',
                    paddingLeft: theme.spacing(2),
                } },
                React.createElement("div", { className: styles.wrapper },
                    contentOutlineVisible && (React.createElement("div", { className: styles.left },
                        React.createElement(ContentOutline, { scroller: this.scrollElement, panelId: `content-outline-container-${exploreId}` }))),
                    React.createElement(CustomScrollbar, { testId: selectors.pages.Explore.General.scrollView, scrollRefCallback: (scrollElement) => (this.scrollElement = scrollElement || undefined), hideHorizontalTrack: true },
                        React.createElement("div", { className: styles.exploreContainer, ref: this.topOfViewRef }, datasourceInstance ? (React.createElement(React.Fragment, null,
                            React.createElement(ContentOutlineItem, { title: "Queries", icon: "arrow" },
                                React.createElement(PanelContainer, { className: styles.queryContainer },
                                    correlationsBox,
                                    React.createElement(QueryRows, { exploreId: exploreId }),
                                    React.createElement(SecondaryActions
                                    // do not allow people to add queries with potentially different datasources in correlations editor mode
                                    , { 
                                        // do not allow people to add queries with potentially different datasources in correlations editor mode
                                        addQueryRowButtonDisabled: isLive || (isCorrelationsEditorMode && datasourceInstance.meta.mixed), 
                                        // We cannot show multiple traces at the same time right now so we do not show add query button.
                                        //TODO:unification
                                        addQueryRowButtonHidden: false, richHistoryRowButtonHidden: richHistoryRowButtonHidden, richHistoryButtonActive: showRichHistory, queryInspectorButtonActive: showQueryInspector, onClickAddQueryRowButton: this.onClickAddQueryRowButton, onClickRichHistoryButton: this.toggleShowRichHistory, onClickQueryInspectorButton: this.toggleShowQueryInspector }),
                                    React.createElement(ResponseErrorContainer, { exploreId: exploreId }))),
                            React.createElement(AutoSizer, { onResize: this.onResize, disableHeight: true }, ({ width }) => {
                                if (width === 0) {
                                    return null;
                                }
                                return (React.createElement("main", { className: cx(styles.exploreMain), style: { width } },
                                    React.createElement(ErrorBoundaryAlert, null,
                                        showPanels && (React.createElement(React.Fragment, null,
                                            showMetrics && graphResult && (React.createElement(ErrorBoundaryAlert, null, this.renderGraphPanel(width))),
                                            showRawPrometheus && (React.createElement(ErrorBoundaryAlert, null, this.renderRawPrometheus(width))),
                                            showTable && React.createElement(ErrorBoundaryAlert, null, this.renderTablePanel(width)),
                                            showLogs && React.createElement(ErrorBoundaryAlert, null, this.renderLogsPanel(width)),
                                            showNodeGraph && (React.createElement(ErrorBoundaryAlert, null, this.renderNodeGraphPanel())),
                                            showFlameGraph && (React.createElement(ErrorBoundaryAlert, null, this.renderFlameGraphPanel())),
                                            showTrace && React.createElement(ErrorBoundaryAlert, null, this.renderTraceViewPanel()),
                                            showLogsSample && (React.createElement(ErrorBoundaryAlert, null, this.renderLogsSamplePanel())),
                                            showCustom && React.createElement(ErrorBoundaryAlert, null, this.renderCustom(width)),
                                            showNoData && React.createElement(ErrorBoundaryAlert, null, this.renderNoData()))),
                                        showRichHistory && (React.createElement(RichHistoryContainer, { width: width, exploreId: exploreId, onClose: this.toggleShowRichHistory })),
                                        showQueryInspector && (React.createElement(ExploreQueryInspector, { exploreId: exploreId, width: width, onClose: this.toggleShowQueryInspector, timeZone: timeZone })))));
                            }))) : (this.renderEmptyState(styles.exploreContainer))))))));
    }
}
function mapStateToProps(state, { exploreId }) {
    const explore = state.explore;
    const { syncedTimes } = explore;
    const item = explore.panes[exploreId];
    const timeZone = getTimeZone(state.user);
    const { datasourceInstance, queryKeys, queries, isLive, graphResult, tableResult, logsResult, showLogs, showMetrics, showTable, showTrace, showCustom, absoluteRange, queryResponse, showNodeGraph, showFlameGraph, showRawPrometheus, supplementaryQueries, correlationEditorHelperData, } = item;
    const loading = selectIsWaitingForData(exploreId)(state);
    const logsSample = supplementaryQueries[SupplementaryQueryType.LogsSample];
    // We want to show logs sample only if there are no log results and if there is already graph or table result
    const showLogsSample = !!(logsSample.dataProvider !== undefined && !logsResult && (graphResult || tableResult));
    return {
        datasourceInstance,
        queryKeys,
        queries,
        isLive,
        graphResult,
        logsResult: logsResult !== null && logsResult !== void 0 ? logsResult : undefined,
        absoluteRange,
        queryResponse,
        syncedTimes,
        timeZone,
        showLogs,
        showMetrics,
        showTable,
        showTrace,
        showCustom,
        showNodeGraph,
        showRawPrometheus,
        showFlameGraph,
        splitted: isSplit(state),
        loading,
        logsSample,
        showLogsSample,
        correlationEditorHelperData,
        correlationEditorDetails: explore.correlationEditorDetails,
    };
}
const mapDispatchToProps = {
    changeSize,
    modifyQueries,
    scanStart,
    scanStopAction,
    setQueries,
    updateTimeRange,
    addQueryRow,
    splitOpen,
    setSupplementaryQueryEnabled,
};
const connector = connect(mapStateToProps, mapDispatchToProps);
export default withTheme2(connector(Explore));
//# sourceMappingURL=Explore.js.map