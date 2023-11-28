import { __awaiter } from "tslib";
import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import { hasLogsContextSupport, hasLogsContextUiSupport, SupplementaryQueryType, hasToggleableQueryFiltersSupport, } from '@grafana/data';
import { getDataSourceSrv } from '@grafana/runtime';
import { Collapse } from '@grafana/ui';
import { getTimeZone } from '../../profile/state/selectors';
import { addResultsToCache, clearCache, loadSupplementaryQueryData, selectIsWaitingForData, setSupplementaryQueryEnabled, } from '../state/query';
import { updateTimeRange } from '../state/time';
import { LiveTailControls } from '../useLiveTailControls';
import { getFieldLinksForExplore } from '../utils/links';
import { LiveLogsWithTheme } from './LiveLogs';
import { Logs } from './Logs';
import { LogsCrossFadeTransition } from './utils/LogsCrossFadeTransition';
class LogsContainer extends PureComponent {
    constructor() {
        super(...arguments);
        this.state = {
            logDetailsFilterAvailable: false,
        };
        this.onChangeTime = (absoluteRange) => {
            const { exploreId, updateTimeRange } = this.props;
            updateTimeRange({ exploreId, absoluteRange });
        };
        this.getLogRowContext = (row, origRow, options) => __awaiter(this, void 0, void 0, function* () {
            const { datasourceInstance, logsQueries } = this.props;
            if (hasLogsContextSupport(datasourceInstance)) {
                const query = this.getQuery(logsQueries, origRow, datasourceInstance);
                return datasourceInstance.getLogRowContext(row, options, query);
            }
            return [];
        });
        this.getLogRowContextQuery = (row, options) => __awaiter(this, void 0, void 0, function* () {
            const { datasourceInstance, logsQueries } = this.props;
            if (hasLogsContextSupport(datasourceInstance) && datasourceInstance.getLogRowContextQuery) {
                const query = this.getQuery(logsQueries, row, datasourceInstance);
                return datasourceInstance.getLogRowContextQuery(row, options, query);
            }
            return null;
        });
        this.getLogRowContextUi = (row, runContextQuery) => {
            const { datasourceInstance, logsQueries } = this.props;
            if (hasLogsContextUiSupport(datasourceInstance) && datasourceInstance.getLogRowContextUi) {
                const query = this.getQuery(logsQueries, row, datasourceInstance);
                return datasourceInstance.getLogRowContextUi(row, runContextQuery, query);
            }
            return React.createElement(React.Fragment, null);
        };
        this.showContextToggle = (row) => {
            const { datasourceInstance } = this.props;
            if (hasLogsContextSupport(datasourceInstance)) {
                return datasourceInstance.showContextToggle(row);
            }
            return false;
        };
        this.getFieldLinks = (field, rowIndex, dataFrame) => {
            const { splitOpenFn, range } = this.props;
            return getFieldLinksForExplore({ field, rowIndex, splitOpenFn, range, dataFrame });
        };
    }
    componentDidMount() {
        this.checkFiltersAvailability();
    }
    componentDidUpdate(prevProps) {
        this.checkFiltersAvailability();
    }
    checkFiltersAvailability() {
        const { logsQueries, datasourceInstance } = this.props;
        if (!logsQueries) {
            return;
        }
        if ((datasourceInstance === null || datasourceInstance === void 0 ? void 0 : datasourceInstance.modifyQuery) || hasToggleableQueryFiltersSupport(datasourceInstance)) {
            this.setState({ logDetailsFilterAvailable: true });
            return;
        }
        const promises = [];
        for (const query of logsQueries) {
            if (query.datasource) {
                promises.push(getDataSourceSrv().get(query.datasource));
            }
        }
        Promise.all(promises).then((dataSources) => {
            const logDetailsFilterAvailable = dataSources.some((ds) => ds.modifyQuery || hasToggleableQueryFiltersSupport(ds));
            this.setState({ logDetailsFilterAvailable });
        });
    }
    getQuery(logsQueries, row, datasourceInstance) {
        // we need to find the query, and we need to be very sure that it's a query
        // from this datasource
        return (logsQueries !== null && logsQueries !== void 0 ? logsQueries : []).find((q) => q.refId === row.dataFrame.refId && q.datasource != null && q.datasource.type === datasourceInstance.type);
    }
    render() {
        var _a;
        const { loading, loadingState, logRows, logsMeta, logsSeries, logsQueries, loadSupplementaryQueryData, setSupplementaryQueryEnabled, onClickFilterLabel, onClickFilterOutLabel, onStartScanning, onStopScanning, absoluteRange, timeZone, visibleRange, scanning, range, width, splitOpenFn, isLive, exploreId, addResultsToCache, clearCache, logsVolume, scrollElement, } = this.props;
        const { logDetailsFilterAvailable } = this.state;
        if (!logRows) {
            return null;
        }
        return (React.createElement(React.Fragment, null,
            React.createElement(LogsCrossFadeTransition, { visible: isLive },
                React.createElement(Collapse, { label: "Logs", loading: false, isOpen: true },
                    React.createElement(LiveTailControls, { exploreId: exploreId }, (controls) => (React.createElement(LiveLogsWithTheme, { logRows: logRows, timeZone: timeZone, stopLive: controls.stop, isPaused: this.props.isPaused, onPause: controls.pause, onResume: controls.resume, onClear: controls.clear, clearedAtIndex: this.props.clearedAtIndex }))))),
            React.createElement(LogsCrossFadeTransition, { visible: !isLive },
                React.createElement(Logs, { exploreId: exploreId, datasourceType: (_a = this.props.datasourceInstance) === null || _a === void 0 ? void 0 : _a.type, logRows: logRows, logsMeta: logsMeta, logsSeries: logsSeries, logsVolumeEnabled: logsVolume.enabled, onSetLogsVolumeEnabled: (enabled) => setSupplementaryQueryEnabled(exploreId, enabled, SupplementaryQueryType.LogsVolume), logsVolumeData: logsVolume.data, logsQueries: logsQueries, width: width, splitOpen: splitOpenFn, loading: loading, loadingState: loadingState, loadLogsVolumeData: () => loadSupplementaryQueryData(exploreId, SupplementaryQueryType.LogsVolume), onChangeTime: this.onChangeTime, onClickFilterLabel: logDetailsFilterAvailable ? onClickFilterLabel : undefined, onClickFilterOutLabel: logDetailsFilterAvailable ? onClickFilterOutLabel : undefined, onStartScanning: onStartScanning, onStopScanning: onStopScanning, absoluteRange: absoluteRange, visibleRange: visibleRange, timeZone: timeZone, scanning: scanning, scanRange: range.raw, showContextToggle: this.showContextToggle, getRowContext: this.getLogRowContext, getRowContextQuery: this.getLogRowContextQuery, getLogRowContextUi: this.getLogRowContextUi, getFieldLinks: this.getFieldLinks, addResultsToCache: () => addResultsToCache(exploreId), clearCache: () => clearCache(exploreId), eventBus: this.props.eventBus, panelState: this.props.panelState, logsFrames: this.props.logsFrames, scrollElement: scrollElement, isFilterLabelActive: logDetailsFilterAvailable ? this.props.isFilterLabelActive : undefined, range: range }))));
    }
}
function mapStateToProps(state, { exploreId }) {
    const explore = state.explore;
    const item = explore.panes[exploreId];
    const { logsResult, scanning, datasourceInstance, isLive, isPaused, clearedAtIndex, range, absoluteRange, supplementaryQueries, } = item;
    const loading = selectIsWaitingForData(exploreId)(state);
    const panelState = item.panelsState;
    const timeZone = getTimeZone(state.user);
    const logsVolume = supplementaryQueries[SupplementaryQueryType.LogsVolume];
    return {
        loading,
        logRows: logsResult === null || logsResult === void 0 ? void 0 : logsResult.rows,
        logsMeta: logsResult === null || logsResult === void 0 ? void 0 : logsResult.meta,
        logsSeries: logsResult === null || logsResult === void 0 ? void 0 : logsResult.series,
        logsQueries: logsResult === null || logsResult === void 0 ? void 0 : logsResult.queries,
        visibleRange: logsResult === null || logsResult === void 0 ? void 0 : logsResult.visibleRange,
        scanning,
        timeZone,
        datasourceInstance,
        isLive,
        isPaused,
        clearedAtIndex,
        range,
        absoluteRange,
        logsVolume,
        panelState,
        logsFrames: item.queryResponse.logsFrames,
    };
}
const mapDispatchToProps = {
    updateTimeRange,
    addResultsToCache,
    clearCache,
    loadSupplementaryQueryData,
    setSupplementaryQueryEnabled,
};
const connector = connect(mapStateToProps, mapDispatchToProps);
export default connector(LogsContainer);
//# sourceMappingURL=LogsContainer.js.map