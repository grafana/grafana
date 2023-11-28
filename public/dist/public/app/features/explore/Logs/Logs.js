import { __awaiter } from "tslib";
import { css } from '@emotion/css';
import { capitalize } from 'lodash';
import memoizeOne from 'memoize-one';
import React, { PureComponent, createRef } from 'react';
import { rangeUtil, LogLevel, LogsDedupStrategy, LogsDedupDescription, LogsSortOrder, LoadingState, CoreApp, DataHoverEvent, DataHoverClearEvent, serializeStateToUrlParam, urlUtil, } from '@grafana/data';
import { config, reportInteraction } from '@grafana/runtime';
import { RadioButtonGroup, Button, InlineField, InlineFieldRow, InlineSwitch, withTheme2, PanelChrome, } from '@grafana/ui';
import store from 'app/core/store';
import { createAndCopyShortLink } from 'app/core/utils/shortLinks';
import { getState, dispatch } from 'app/store/store';
import { LogRows } from '../../logs/components/LogRows';
import { LogRowContextModal } from '../../logs/components/log-context/LogRowContextModal';
import { dedupLogRows, filterLogLevels } from '../../logs/logsModel';
import { getUrlStateFromPaneState } from '../hooks/useStateSync';
import { changePanelState } from '../state/explorePane';
import { LogsMetaRow } from './LogsMetaRow';
import LogsNavigation from './LogsNavigation';
import { LogsTable } from './LogsTable';
import { LogsVolumePanelList } from './LogsVolumePanelList';
import { SETTINGS_KEYS } from './utils/logs';
const scrollableLogsContainer = config.featureToggles.exploreScrollableLogsContainer;
// we need to define the order of these explicitly
const DEDUP_OPTIONS = [
    LogsDedupStrategy.none,
    LogsDedupStrategy.exact,
    LogsDedupStrategy.numbers,
    LogsDedupStrategy.signature,
];
class UnthemedLogs extends PureComponent {
    constructor(props) {
        super(props);
        this.topLogsRef = createRef();
        this.state = {
            showLabels: store.getBool(SETTINGS_KEYS.showLabels, false),
            showTime: store.getBool(SETTINGS_KEYS.showTime, true),
            wrapLogMessage: store.getBool(SETTINGS_KEYS.wrapLogMessage, true),
            prettifyLogMessage: store.getBool(SETTINGS_KEYS.prettifyLogMessage, false),
            dedupStrategy: LogsDedupStrategy.none,
            hiddenLogLevels: [],
            logsSortOrder: store.get(SETTINGS_KEYS.logsSortOrder) || LogsSortOrder.Descending,
            isFlipping: false,
            displayedFields: [],
            forceEscape: false,
            contextOpen: false,
            contextRow: undefined,
            tableFrame: undefined,
            visualisationType: 'logs',
            logsContainer: undefined,
        };
        this.onLogRowHover = (row) => {
            if (!row) {
                this.props.eventBus.publish(new DataHoverClearEvent());
            }
            else {
                this.props.eventBus.publish(new DataHoverEvent({
                    point: {
                        time: row.timeEpochMs,
                    },
                }));
            }
        };
        this.onLogsContainerRef = (node) => {
            this.setState({ logsContainer: node });
        };
        this.onChangeLogsSortOrder = () => {
            this.setState({ isFlipping: true });
            // we are using setTimeout here to make sure that disabled button is rendered before the rendering of reordered logs
            this.flipOrderTimer = window.setTimeout(() => {
                this.setState((prevState) => {
                    const newSortOrder = prevState.logsSortOrder === LogsSortOrder.Descending ? LogsSortOrder.Ascending : LogsSortOrder.Descending;
                    store.set(SETTINGS_KEYS.logsSortOrder, newSortOrder);
                    return { logsSortOrder: newSortOrder };
                });
            }, 0);
            this.cancelFlippingTimer = window.setTimeout(() => this.setState({ isFlipping: false }), 1000);
        };
        this.onEscapeNewlines = () => {
            this.setState((prevState) => ({
                forceEscape: !prevState.forceEscape,
            }));
        };
        this.onChangeVisualisation = (visualisation) => {
            this.setState(() => ({
                visualisationType: visualisation,
            }));
        };
        this.onChangeDedup = (dedupStrategy) => {
            reportInteraction('grafana_explore_logs_deduplication_clicked', {
                deduplicationType: dedupStrategy,
                datasourceType: this.props.datasourceType,
            });
            this.setState({ dedupStrategy });
        };
        this.onChangeLabels = (event) => {
            const { target } = event;
            if (target) {
                const showLabels = target.checked;
                this.setState({
                    showLabels,
                });
                store.set(SETTINGS_KEYS.showLabels, showLabels);
            }
        };
        this.onChangeTime = (event) => {
            const { target } = event;
            if (target) {
                const showTime = target.checked;
                this.setState({
                    showTime,
                });
                store.set(SETTINGS_KEYS.showTime, showTime);
            }
        };
        this.onChangeWrapLogMessage = (event) => {
            const { target } = event;
            if (target) {
                const wrapLogMessage = target.checked;
                this.setState({
                    wrapLogMessage,
                });
                store.set(SETTINGS_KEYS.wrapLogMessage, wrapLogMessage);
            }
        };
        this.onChangePrettifyLogMessage = (event) => {
            const { target } = event;
            if (target) {
                const prettifyLogMessage = target.checked;
                this.setState({
                    prettifyLogMessage,
                });
                store.set(SETTINGS_KEYS.prettifyLogMessage, prettifyLogMessage);
            }
        };
        this.onToggleLogLevel = (hiddenRawLevels) => {
            const hiddenLogLevels = hiddenRawLevels.map((level) => LogLevel[level]);
            this.setState({ hiddenLogLevels });
        };
        this.onToggleLogsVolumeCollapse = (collapsed) => {
            this.props.onSetLogsVolumeEnabled(!collapsed);
            reportInteraction('grafana_explore_logs_histogram_toggle_clicked', {
                datasourceType: this.props.datasourceType,
                type: !collapsed ? 'open' : 'close',
            });
        };
        this.onClickScan = (event) => {
            event.preventDefault();
            if (this.props.onStartScanning) {
                this.props.onStartScanning();
                reportInteraction('grafana_explore_logs_scanning_button_clicked', {
                    type: 'start',
                    datasourceType: this.props.datasourceType,
                });
            }
        };
        this.onClickStopScan = (event) => {
            event.preventDefault();
            if (this.props.onStopScanning) {
                this.props.onStopScanning();
            }
        };
        this.showField = (key) => {
            const index = this.state.displayedFields.indexOf(key);
            if (index === -1) {
                this.setState((state) => {
                    return {
                        displayedFields: state.displayedFields.concat(key),
                    };
                });
            }
        };
        this.hideField = (key) => {
            const index = this.state.displayedFields.indexOf(key);
            if (index > -1) {
                this.setState((state) => {
                    return {
                        displayedFields: state.displayedFields.filter((k) => key !== k),
                    };
                });
            }
        };
        this.clearDetectedFields = () => {
            this.setState((state) => {
                return {
                    displayedFields: [],
                };
            });
        };
        this.onCloseContext = () => {
            this.setState({
                contextOpen: false,
                contextRow: undefined,
            });
        };
        this.onOpenContext = (row, onClose) => {
            // we are setting the `contextOpen` open state and passing it down to the `LogRow` in order to highlight the row when a LogContext is open
            this.setState({
                contextOpen: true,
                contextRow: row,
            });
            reportInteraction('grafana_explore_logs_log_context_opened', {
                datasourceType: row.datasourceType,
                logRowUid: row.uid,
            });
            this.onCloseContext = () => {
                this.setState({
                    contextOpen: false,
                    contextRow: undefined,
                });
                reportInteraction('grafana_explore_logs_log_context_closed', {
                    datasourceType: row.datasourceType,
                    logRowUid: row.uid,
                });
                onClose();
            };
        };
        this.onPermalinkClick = (row) => __awaiter(this, void 0, void 0, function* () {
            var _a;
            // this is an extra check, to be sure that we are not
            // creating permalinks for logs without an id-field.
            // normally it should never happen, because we do not
            // display the permalink button in such cases.
            if (row.rowId === undefined) {
                return;
            }
            // get explore state, add log-row-id and make timerange absolute
            const urlState = getUrlStateFromPaneState(getState().explore.panes[this.props.exploreId]);
            urlState.panelsState = Object.assign(Object.assign({}, this.props.panelState), { logs: { id: row.uid } });
            urlState.range = {
                from: new Date(this.props.absoluteRange.from).toISOString(),
                to: new Date(this.props.absoluteRange.to).toISOString(),
            };
            // append changed urlState to baseUrl
            const serializedState = serializeStateToUrlParam(urlState);
            const baseUrl = /.*(?=\/explore)/.exec(`${window.location.href}`)[0];
            const url = urlUtil.renderUrl(`${baseUrl}/explore`, { left: serializedState });
            yield createAndCopyShortLink(url);
            reportInteraction('grafana_explore_logs_permalink_clicked', {
                datasourceType: (_a = row.datasourceType) !== null && _a !== void 0 ? _a : 'unknown',
                logRowUid: row.uid,
                logRowLevel: row.logLevel,
            });
        });
        this.scrollIntoView = (element) => {
            var _a;
            if (config.featureToggles.exploreScrollableLogsContainer) {
                if (this.state.logsContainer) {
                    (_a = this.topLogsRef.current) === null || _a === void 0 ? void 0 : _a.scrollIntoView();
                    this.state.logsContainer.scroll({
                        behavior: 'smooth',
                        top: this.state.logsContainer.scrollTop + element.getBoundingClientRect().top - window.innerHeight / 2,
                    });
                }
                return;
            }
            const { scrollElement } = this.props;
            if (scrollElement) {
                scrollElement.scroll({
                    behavior: 'smooth',
                    top: scrollElement.scrollTop + element.getBoundingClientRect().top - window.innerHeight / 2,
                });
            }
        };
        this.checkUnescapedContent = memoizeOne((logRows) => {
            return !!logRows.some((r) => r.hasUnescapedContent);
        });
        this.dedupRows = memoizeOne((logRows, dedupStrategy) => {
            const dedupedRows = dedupLogRows(logRows, dedupStrategy);
            const dedupCount = dedupedRows.reduce((sum, row) => (row.duplicates ? sum + row.duplicates : sum), 0);
            return { dedupedRows, dedupCount };
        });
        this.filterRows = memoizeOne((logRows, hiddenLogLevels) => {
            return filterLogLevels(logRows, new Set(hiddenLogLevels));
        });
        this.createNavigationRange = memoizeOne((logRows) => {
            if (!logRows || logRows.length === 0) {
                return undefined;
            }
            const firstTimeStamp = logRows[0].timeEpochMs;
            const lastTimeStamp = logRows[logRows.length - 1].timeEpochMs;
            if (lastTimeStamp < firstTimeStamp) {
                return { from: lastTimeStamp, to: firstTimeStamp };
            }
            return { from: firstTimeStamp, to: lastTimeStamp };
        });
        this.scrollToTopLogs = () => {
            var _a;
            if (config.featureToggles.exploreScrollableLogsContainer) {
                if (this.state.logsContainer) {
                    this.state.logsContainer.scroll({
                        behavior: 'auto',
                        top: 0,
                    });
                }
            }
            else {
                (_a = this.topLogsRef.current) === null || _a === void 0 ? void 0 : _a.scrollIntoView();
            }
        };
        this.logsVolumeEventBus = props.eventBus.newScopedBus('logsvolume', { onlyLocal: false });
    }
    componentWillUnmount() {
        if (this.flipOrderTimer) {
            window.clearTimeout(this.flipOrderTimer);
        }
        if (this.cancelFlippingTimer) {
            window.clearTimeout(this.cancelFlippingTimer);
        }
    }
    componentDidUpdate(prevProps) {
        var _a, _b;
        if (this.props.loading && !prevProps.loading && ((_b = (_a = this.props.panelState) === null || _a === void 0 ? void 0 : _a.logs) === null || _b === void 0 ? void 0 : _b.id)) {
            // loading stopped, so we need to remove any permalinked log lines
            delete this.props.panelState.logs.id;
            dispatch(changePanelState(this.props.exploreId, 'logs', Object.assign({}, this.props.panelState)));
        }
    }
    render() {
        var _a, _b;
        const { width, splitOpen, logRows, logsMeta, logsVolumeEnabled, logsVolumeData, loadLogsVolumeData, loading = false, onClickFilterLabel, onClickFilterOutLabel, timeZone, scanning, scanRange, showContextToggle, absoluteRange, onChangeTime, getFieldLinks, theme, logsQueries, clearCache, addResultsToCache, exploreId, getRowContext, getLogRowContextUi, getRowContextQuery, } = this.props;
        const { showLabels, showTime, wrapLogMessage, prettifyLogMessage, dedupStrategy, hiddenLogLevels, logsSortOrder, isFlipping, displayedFields, forceEscape, contextOpen, contextRow, } = this.state;
        const styles = getStyles(theme, wrapLogMessage);
        const hasData = logRows && logRows.length > 0;
        const hasUnescapedContent = this.checkUnescapedContent(logRows);
        const filteredLogs = this.filterRows(logRows, hiddenLogLevels);
        const { dedupedRows, dedupCount } = this.dedupRows(filteredLogs, dedupStrategy);
        const navigationRange = this.createNavigationRange(logRows);
        const scanText = scanRange ? `Scanning ${rangeUtil.describeTimeRange(scanRange)}` : 'Scanning...';
        return (React.createElement(React.Fragment, null,
            getRowContext && contextRow && (React.createElement(LogRowContextModal, { open: contextOpen, row: contextRow, onClose: this.onCloseContext, getRowContext: (row, options) => getRowContext(row, contextRow, options), getRowContextQuery: getRowContextQuery, getLogRowContextUi: getLogRowContextUi, logsSortOrder: logsSortOrder, timeZone: timeZone })),
            React.createElement(PanelChrome, { title: "Logs volume", collapsible: true, collapsed: !logsVolumeEnabled, onToggleCollapse: this.onToggleLogsVolumeCollapse }, logsVolumeEnabled && (React.createElement(LogsVolumePanelList, { absoluteRange: absoluteRange, width: width, logsVolumeData: logsVolumeData, onUpdateTimeRange: onChangeTime, timeZone: timeZone, splitOpen: splitOpen, onLoadLogsVolume: loadLogsVolumeData, onHiddenSeriesChanged: this.onToggleLogLevel, eventBus: this.logsVolumeEventBus, onClose: () => this.onToggleLogsVolumeCollapse(true) }))),
            React.createElement(PanelChrome, { title: config.featureToggles.logsExploreTableVisualisation
                    ? this.state.visualisationType === 'logs'
                        ? 'Logs'
                        : 'Table'
                    : 'Logs', actions: React.createElement(React.Fragment, null, config.featureToggles.logsExploreTableVisualisation && (React.createElement("div", { className: styles.visualisationType },
                    React.createElement(RadioButtonGroup, { className: styles.visualisationTypeRadio, options: [
                            {
                                label: 'Table',
                                value: 'table',
                                description: 'Show results in table visualisation',
                            },
                            {
                                label: 'Logs',
                                value: 'logs',
                                description: 'Show results in logs visualisation',
                            },
                        ], size: "sm", value: this.state.visualisationType, onChange: this.onChangeVisualisation })))), loadingState: loading ? LoadingState.Loading : LoadingState.Done },
                React.createElement("div", { className: styles.stickyNavigation },
                    this.state.visualisationType !== 'table' && (React.createElement("div", { className: styles.logOptions },
                        React.createElement(InlineFieldRow, null,
                            React.createElement(InlineField, { label: "Time", className: styles.horizontalInlineLabel, transparent: true },
                                React.createElement(InlineSwitch, { value: showTime, onChange: this.onChangeTime, className: styles.horizontalInlineSwitch, transparent: true, id: `show-time_${exploreId}` })),
                            React.createElement(InlineField, { label: "Unique labels", className: styles.horizontalInlineLabel, transparent: true },
                                React.createElement(InlineSwitch, { value: showLabels, onChange: this.onChangeLabels, className: styles.horizontalInlineSwitch, transparent: true, id: `unique-labels_${exploreId}` })),
                            React.createElement(InlineField, { label: "Wrap lines", className: styles.horizontalInlineLabel, transparent: true },
                                React.createElement(InlineSwitch, { value: wrapLogMessage, onChange: this.onChangeWrapLogMessage, className: styles.horizontalInlineSwitch, transparent: true, id: `wrap-lines_${exploreId}` })),
                            React.createElement(InlineField, { label: "Prettify JSON", className: styles.horizontalInlineLabel, transparent: true },
                                React.createElement(InlineSwitch, { value: prettifyLogMessage, onChange: this.onChangePrettifyLogMessage, className: styles.horizontalInlineSwitch, transparent: true, id: `prettify_${exploreId}` })),
                            React.createElement(InlineField, { label: "Deduplication", className: styles.horizontalInlineLabel, transparent: true },
                                React.createElement(RadioButtonGroup, { options: DEDUP_OPTIONS.map((dedupType) => ({
                                        label: capitalize(dedupType),
                                        value: dedupType,
                                        description: LogsDedupDescription[dedupType],
                                    })), value: dedupStrategy, onChange: this.onChangeDedup, className: styles.radioButtons }))),
                        React.createElement("div", null,
                            React.createElement(InlineField, { label: "Display results", className: styles.horizontalInlineLabel, transparent: true },
                                React.createElement(RadioButtonGroup, { disabled: isFlipping, options: [
                                        {
                                            label: 'Newest first',
                                            value: LogsSortOrder.Descending,
                                            description: 'Show results newest to oldest',
                                        },
                                        {
                                            label: 'Oldest first',
                                            value: LogsSortOrder.Ascending,
                                            description: 'Show results oldest to newest',
                                        },
                                    ], value: logsSortOrder, onChange: this.onChangeLogsSortOrder, className: styles.radioButtons }))))),
                    React.createElement("div", { ref: this.topLogsRef }),
                    React.createElement(LogsMetaRow, { logRows: logRows, meta: logsMeta || [], dedupStrategy: dedupStrategy, dedupCount: dedupCount, hasUnescapedContent: hasUnescapedContent, forceEscape: forceEscape, displayedFields: displayedFields, onEscapeNewlines: this.onEscapeNewlines, clearDetectedFields: this.clearDetectedFields })),
                React.createElement("div", { className: styles.logsSection },
                    this.state.visualisationType === 'table' && hasData && (React.createElement("div", { className: styles.logRows, "data-testid": "logRowsTable" },
                        React.createElement(LogsTable, { logsSortOrder: this.state.logsSortOrder, range: this.props.range, splitOpen: this.props.splitOpen, timeZone: timeZone, width: width - 80, logsFrames: this.props.logsFrames }))),
                    this.state.visualisationType === 'logs' && hasData && (React.createElement("div", { className: styles.logRows, "data-testid": "logRows", ref: this.onLogsContainerRef },
                        React.createElement(LogRows, { logRows: logRows, deduplicatedRows: dedupedRows, dedupStrategy: dedupStrategy, onClickFilterLabel: onClickFilterLabel, onClickFilterOutLabel: onClickFilterOutLabel, showContextToggle: showContextToggle, showLabels: showLabels, showTime: showTime, enableLogDetails: true, forceEscape: forceEscape, wrapLogMessage: wrapLogMessage, prettifyLogMessage: prettifyLogMessage, timeZone: timeZone, getFieldLinks: getFieldLinks, logsSortOrder: logsSortOrder, displayedFields: displayedFields, onClickShowField: this.showField, onClickHideField: this.hideField, app: CoreApp.Explore, onLogRowHover: this.onLogRowHover, onOpenContext: this.onOpenContext, onPermalinkClick: this.onPermalinkClick, permalinkedRowId: (_b = (_a = this.props.panelState) === null || _a === void 0 ? void 0 : _a.logs) === null || _b === void 0 ? void 0 : _b.id, scrollIntoView: this.scrollIntoView, isFilterLabelActive: this.props.isFilterLabelActive, containerRendered: !!this.state.logsContainer }))),
                    !loading && !hasData && !scanning && (React.createElement("div", { className: styles.logRows },
                        React.createElement("div", { className: styles.noData },
                            "No logs found.",
                            React.createElement(Button, { size: "sm", variant: "secondary", onClick: this.onClickScan }, "Scan for older logs")))),
                    scanning && (React.createElement("div", { className: styles.logRows },
                        React.createElement("div", { className: styles.noData },
                            React.createElement("span", null, scanText),
                            React.createElement(Button, { size: "sm", variant: "secondary", onClick: this.onClickStopScan }, "Stop scan")))),
                    React.createElement(LogsNavigation, { logsSortOrder: logsSortOrder, visibleRange: navigationRange !== null && navigationRange !== void 0 ? navigationRange : absoluteRange, absoluteRange: absoluteRange, timeZone: timeZone, onChangeTime: onChangeTime, loading: loading, queries: logsQueries !== null && logsQueries !== void 0 ? logsQueries : [], scrollToTopLogs: this.scrollToTopLogs, addResultsToCache: addResultsToCache, clearCache: clearCache })))));
    }
}
export const Logs = withTheme2(UnthemedLogs);
const getStyles = (theme, wrapLogMessage) => {
    return {
        noData: css `
      > * {
        margin-left: 0.5em;
      }
    `,
        logOptions: css `
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      flex-wrap: wrap;
      background-color: ${theme.colors.background.primary};
      padding: ${theme.spacing(1, 2)};
      border-radius: ${theme.shape.radius.default};
      margin: ${theme.spacing(0, 0, 1)};
      border: 1px solid ${theme.colors.border.medium};
    `,
        headerButton: css `
      margin: ${theme.spacing(0.5, 0, 0, 1)};
    `,
        horizontalInlineLabel: css `
      > label {
        margin-right: 0;
      }
    `,
        horizontalInlineSwitch: css `
      padding: 0 ${theme.spacing(1)} 0 0;
    `,
        radioButtons: css `
      margin: 0;
    `,
        logsSection: css `
      display: flex;
      flex-direction: row;
      justify-content: space-between;
    `,
        logRows: css `
      overflow-x: ${scrollableLogsContainer ? 'scroll;' : `${wrapLogMessage ? 'unset' : 'scroll'};`}
      overflow-y: visible;
      width: 100%;
      ${scrollableLogsContainer && 'max-height: calc(100vh - 170px);'}
    `,
        visualisationType: css `
      display: flex;
      flex: 1;
      justify-content: space-between;
    `,
        visualisationTypeRadio: css `
      margin: 0 0 0 ${theme.spacing(1)};
    `,
        stickyNavigation: css `
      ${scrollableLogsContainer && 'margin-bottom: 0px'}
      overflow: visible;
    `,
    };
};
//# sourceMappingURL=Logs.js.map