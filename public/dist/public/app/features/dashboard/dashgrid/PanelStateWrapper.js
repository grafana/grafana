import { __awaiter } from "tslib";
import React, { PureComponent } from 'react';
import { Subscription } from 'rxjs';
import { AnnotationChangeEvent, CoreApp, DashboardCursorSync, getDataSourceRef, getDefaultTimeRange, LoadingState, toDataFrameDTO, toUtc, } from '@grafana/data';
import { RefreshEvent } from '@grafana/runtime';
import { ErrorBoundary, PanelChrome, PanelContextProvider, } from '@grafana/ui';
import config from 'app/core/config';
import { profiler } from 'app/core/profiler';
import { applyPanelTimeOverrides } from 'app/features/dashboard/utils/panel';
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';
import { applyFilterFromTable } from 'app/features/variables/adhoc/actions';
import { onUpdatePanelSnapshotData } from 'app/plugins/datasource/grafana/utils';
import { changeSeriesColorConfigFactory } from 'app/plugins/panel/timeseries/overrides/colorSeriesConfigFactory';
import { dispatch } from 'app/store/store';
import { RenderEvent } from 'app/types/events';
import { deleteAnnotation, saveAnnotation, updateAnnotation } from '../../annotations/api';
import { getDashboardQueryRunner } from '../../query/state/DashboardQueryRunner/DashboardQueryRunner';
import { getTimeSrv } from '../services/TimeSrv';
import { getPanelChromeProps } from '../utils/getPanelChromeProps';
import { loadSnapshotData } from '../utils/loadSnapshotData';
import { PanelHeaderMenuWrapper } from './PanelHeader/PanelHeaderMenuWrapper';
import { PanelLoadTimeMonitor } from './PanelLoadTimeMonitor';
import { seriesVisibilityConfigFactory } from './SeriesVisibilityConfigFactory';
import { liveTimer } from './liveTimer';
import { PanelOptionsLogger } from './panelOptionsLogger';
const DEFAULT_PLUGIN_ERROR = 'Error in plugin';
export class PanelStateWrapper extends PureComponent {
    constructor(props) {
        super(props);
        this.timeSrv = getTimeSrv();
        this.subs = new Subscription();
        this.eventFilter = { onlyLocal: true };
        this.panelOptionsLogger = undefined;
        // Due to a mutable panel model we get the sync settings via function that proactively reads from the model
        this.getSync = () => (this.props.isEditing ? DashboardCursorSync.Off : this.props.dashboard.graphTooltip);
        this.onInstanceStateChange = (value) => {
            this.props.onInstanceStateChange(value);
            this.setState({
                context: Object.assign(Object.assign({}, this.state.context), { instanceState: value }),
            });
        };
        this.onUpdateData = (frames) => {
            return onUpdatePanelSnapshotData(this.props.panel, frames);
        };
        this.onSeriesColorChange = (label, color) => {
            this.onFieldConfigChange(changeSeriesColorConfigFactory(label, color, this.props.panel.fieldConfig));
        };
        this.onSeriesVisibilityChange = (label, mode) => {
            this.onFieldConfigChange(seriesVisibilityConfigFactory(label, mode, this.props.panel.fieldConfig, this.state.data.series));
        };
        this.onToggleLegendSort = (sortKey) => {
            const legendOptions = this.props.panel.options.legend;
            // We don't want to do anything when legend options are not available
            if (!legendOptions) {
                return;
            }
            let sortDesc = legendOptions.sortDesc;
            let sortBy = legendOptions.sortBy;
            if (sortKey !== sortBy) {
                sortDesc = undefined;
            }
            // if already sort ascending, disable sorting
            if (sortDesc === false) {
                sortBy = undefined;
                sortDesc = undefined;
            }
            else {
                sortDesc = !sortDesc;
                sortBy = sortKey;
            }
            this.onOptionsChange(Object.assign(Object.assign({}, this.props.panel.options), { legend: Object.assign(Object.assign({}, legendOptions), { sortBy, sortDesc }) }));
        };
        this.onRefresh = () => {
            const { dashboard, panel, isInView, width } = this.props;
            if (!isInView) {
                this.setState({ refreshWhenInView: true });
                return;
            }
            const timeData = applyPanelTimeOverrides(panel, this.timeSrv.timeRange());
            // Issue Query
            if (this.wantsQueryExecution) {
                if (width < 0) {
                    return;
                }
                if (this.state.refreshWhenInView) {
                    this.setState({ refreshWhenInView: false });
                }
                panel.runAllPanelQueries({
                    dashboardUID: dashboard.uid,
                    dashboardTimezone: dashboard.getTimezone(),
                    timeData,
                    width,
                });
            }
            else {
                // The panel should render on refresh as well if it doesn't have a query, like clock panel
                this.setState({
                    data: Object.assign(Object.assign({}, this.state.data), { timeRange: this.timeSrv.timeRange() }),
                    renderCounter: this.state.renderCounter + 1,
                    liveTime: undefined,
                });
            }
        };
        this.onRender = () => {
            const stateUpdate = { renderCounter: this.state.renderCounter + 1 };
            this.setState(stateUpdate);
        };
        this.onOptionsChange = (options) => {
            this.props.panel.updateOptions(options);
        };
        this.onFieldConfigChange = (config) => {
            this.props.panel.updateFieldConfig(config);
        };
        this.onPanelError = (error) => {
            if (config.featureToggles.panelMonitoring && this.getPanelContextApp() === CoreApp.PanelEditor) {
                this.logPanelChangesOnError();
            }
            const errorMessage = error.message || DEFAULT_PLUGIN_ERROR;
            if (this.state.errorMessage !== errorMessage) {
                this.setState({ errorMessage });
            }
        };
        this.onPanelErrorRecover = () => {
            this.setState({ errorMessage: undefined });
        };
        this.onAnnotationCreate = (event) => __awaiter(this, void 0, void 0, function* () {
            const isRegion = event.from !== event.to;
            const anno = {
                dashboardUID: this.props.dashboard.uid,
                panelId: this.props.panel.id,
                isRegion,
                time: event.from,
                timeEnd: isRegion ? event.to : 0,
                tags: event.tags,
                text: event.description,
            };
            yield saveAnnotation(anno);
            getDashboardQueryRunner().run({ dashboard: this.props.dashboard, range: this.timeSrv.timeRange() });
            this.state.context.eventBus.publish(new AnnotationChangeEvent(anno));
        });
        this.onAnnotationDelete = (id) => __awaiter(this, void 0, void 0, function* () {
            yield deleteAnnotation({ id });
            getDashboardQueryRunner().run({ dashboard: this.props.dashboard, range: this.timeSrv.timeRange() });
            this.state.context.eventBus.publish(new AnnotationChangeEvent({ id }));
        });
        this.onAnnotationUpdate = (event) => __awaiter(this, void 0, void 0, function* () {
            const isRegion = event.from !== event.to;
            const anno = {
                id: event.id,
                dashboardUID: this.props.dashboard.uid,
                panelId: this.props.panel.id,
                isRegion,
                time: event.from,
                timeEnd: isRegion ? event.to : 0,
                tags: event.tags,
                text: event.description,
            };
            yield updateAnnotation(anno);
            getDashboardQueryRunner().run({ dashboard: this.props.dashboard, range: this.timeSrv.timeRange() });
            this.state.context.eventBus.publish(new AnnotationChangeEvent(anno));
        });
        this.onChangeTimeRange = (timeRange) => {
            this.timeSrv.setTime({
                from: toUtc(timeRange.from),
                to: toUtc(timeRange.to),
            });
        };
        this.onAddAdHocFilter = (filter) => {
            const { key, value, operator } = filter;
            // When the datasource is null/undefined (for a default datasource), we use getInstanceSettings
            // to find the real datasource ref for the default datasource.
            const datasourceInstance = getDatasourceSrv().getInstanceSettings(this.props.panel.datasource);
            const datasourceRef = datasourceInstance && getDataSourceRef(datasourceInstance);
            if (!datasourceRef) {
                return;
            }
            dispatch(applyFilterFromTable({ datasource: datasourceRef, key, operator, value }));
        };
        // Can this eventBus be on PanelModel?  when we have more complex event filtering, that may be a better option
        const eventBus = props.dashboard.events.newScopedBus(`panel:${props.panel.id}`, this.eventFilter);
        this.state = {
            isFirstLoad: true,
            renderCounter: 0,
            refreshWhenInView: false,
            context: {
                eventsScope: '__global_',
                eventBus,
                app: this.getPanelContextApp(),
                sync: this.getSync,
                onSeriesColorChange: this.onSeriesColorChange,
                onToggleSeriesVisibility: this.onSeriesVisibilityChange,
                onAnnotationCreate: this.onAnnotationCreate,
                onAnnotationUpdate: this.onAnnotationUpdate,
                onAnnotationDelete: this.onAnnotationDelete,
                onInstanceStateChange: this.onInstanceStateChange,
                onToggleLegendSort: this.onToggleLegendSort,
                canAddAnnotations: props.dashboard.canAddAnnotations.bind(props.dashboard),
                canEditAnnotations: props.dashboard.canEditAnnotations.bind(props.dashboard),
                canDeleteAnnotations: props.dashboard.canDeleteAnnotations.bind(props.dashboard),
                onAddAdHocFilter: this.onAddAdHocFilter,
                onUpdateData: this.onUpdateData,
            },
            data: this.getInitialPanelDataState(),
        };
        if (config.featureToggles.panelMonitoring && this.getPanelContextApp() === CoreApp.PanelEditor) {
            const panelInfo = {
                panelId: String(props.panel.id),
                panelType: props.panel.type,
                panelTitle: props.panel.title,
            };
            this.panelOptionsLogger = new PanelOptionsLogger(props.panel.getOptions(), props.panel.fieldConfig, panelInfo);
        }
    }
    getPanelContextApp() {
        if (this.props.isEditing) {
            return CoreApp.PanelEditor;
        }
        if (this.props.isViewing) {
            return CoreApp.PanelViewer;
        }
        return CoreApp.Dashboard;
    }
    getInitialPanelDataState() {
        return {
            state: LoadingState.NotStarted,
            series: [],
            timeRange: getDefaultTimeRange(),
        };
    }
    componentDidMount() {
        const { panel, dashboard } = this.props;
        // Subscribe to panel events
        this.subs.add(panel.events.subscribe(RefreshEvent, this.onRefresh));
        this.subs.add(panel.events.subscribe(RenderEvent, this.onRender));
        dashboard.panelInitialized(this.props.panel);
        // Move snapshot data into the query response
        if (this.hasPanelSnapshot) {
            this.setState({
                data: loadSnapshotData(panel, dashboard),
                isFirstLoad: false,
            });
            return;
        }
        if (!this.wantsQueryExecution) {
            this.setState({ isFirstLoad: false });
        }
        this.subs.add(panel
            .getQueryRunner()
            .getData({ withTransforms: true, withFieldConfig: true })
            .subscribe({
            next: (data) => this.onDataUpdate(data),
        }));
        // Listen for live timer events
        liveTimer.listen(this);
    }
    componentWillUnmount() {
        this.subs.unsubscribe();
        liveTimer.remove(this);
    }
    liveTimeChanged(liveTime) {
        const { data } = this.state;
        if (data.timeRange) {
            const delta = liveTime.to.valueOf() - data.timeRange.to.valueOf();
            if (delta < 100) {
                // 10hz
                console.log('Skip tick render', this.props.panel.title, delta);
                return;
            }
        }
        this.setState({ liveTime });
    }
    componentDidUpdate(prevProps) {
        const { isInView, width } = this.props;
        const { context } = this.state;
        const app = this.getPanelContextApp();
        if (context.app !== app) {
            this.setState({
                context: Object.assign(Object.assign({}, context), { app }),
            });
        }
        // View state has changed
        if (isInView !== prevProps.isInView) {
            if (isInView) {
                // Check if we need a delayed refresh
                if (this.state.refreshWhenInView) {
                    this.onRefresh();
                }
            }
        }
        // The timer depends on panel width
        if (width !== prevProps.width) {
            liveTimer.updateInterval(this);
        }
    }
    // Updates the response with information from the stream
    // The next is outside a react synthetic event so setState is not batched
    // So in this context we can only do a single call to setState
    onDataUpdate(data) {
        const { dashboard, panel, plugin } = this.props;
        // Ignore this data update if we are now a non data panel
        if (plugin.meta.skipDataQuery) {
            this.setState({ data: this.getInitialPanelDataState() });
            return;
        }
        let { isFirstLoad } = this.state;
        let errorMessage;
        switch (data.state) {
            case LoadingState.Loading:
                // Skip updating state data if it is already in loading state
                // This is to avoid rendering partial loading responses
                if (this.state.data.state === LoadingState.Loading) {
                    return;
                }
                break;
            case LoadingState.Error:
                const { error, errors } = data;
                if (errors === null || errors === void 0 ? void 0 : errors.length) {
                    if (errors.length === 1) {
                        errorMessage = errors[0].message;
                    }
                    else {
                        errorMessage = 'Multiple errors found. Click for more details';
                    }
                }
                else if (error) {
                    if (errorMessage !== error.message) {
                        errorMessage = error.message;
                    }
                }
                break;
            case LoadingState.Done:
                // If we are doing a snapshot save data in panel model
                if (dashboard.snapshot) {
                    panel.snapshotData = data.series.map((frame) => toDataFrameDTO(frame));
                }
                if (isFirstLoad) {
                    isFirstLoad = false;
                }
                break;
        }
        this.setState({ isFirstLoad, errorMessage, data, liveTime: undefined });
    }
    logPanelChangesOnError() {
        this.panelOptionsLogger.logChanges(this.props.panel.getOptions(), this.props.panel.fieldConfig);
    }
    get hasPanelSnapshot() {
        const { panel } = this.props;
        return panel.snapshotData && panel.snapshotData.length;
    }
    get wantsQueryExecution() {
        return !(this.props.plugin.meta.skipDataQuery || this.hasPanelSnapshot);
    }
    shouldSignalRenderingCompleted(loadingState, pluginMeta) {
        return loadingState === LoadingState.Done || loadingState === LoadingState.Error || pluginMeta.skipDataQuery;
    }
    skipFirstRender(loadingState) {
        const { isFirstLoad } = this.state;
        return (this.wantsQueryExecution &&
            isFirstLoad &&
            (loadingState === LoadingState.Loading || loadingState === LoadingState.NotStarted));
    }
    renderPanelContent(innerWidth, innerHeight) {
        var _a, _b;
        const { panel, plugin, dashboard } = this.props;
        const { renderCounter, data } = this.state;
        const { state: loadingState } = data;
        // do not render component until we have first data
        if (this.skipFirstRender(loadingState)) {
            return null;
        }
        // This is only done to increase a counter that is used by backend
        // image rendering to know when to capture image
        if (this.shouldSignalRenderingCompleted(loadingState, plugin.meta)) {
            profiler.renderingCompleted();
        }
        const PanelComponent = plugin.panel;
        const timeRange = (_b = (_a = this.state.liveTime) !== null && _a !== void 0 ? _a : data.timeRange) !== null && _b !== void 0 ? _b : this.timeSrv.timeRange();
        const panelOptions = panel.getOptions();
        // Update the event filter (dashboard settings may have changed)
        // Yes this is called ever render for a function that is triggered on every mouse move
        this.eventFilter.onlyLocal = dashboard.graphTooltip === 0;
        return (React.createElement(React.Fragment, null,
            React.createElement(PanelContextProvider, { value: this.state.context },
                React.createElement(PanelComponent, { id: panel.id, data: data, title: panel.title, timeRange: timeRange, timeZone: this.props.dashboard.getTimezone(), options: panelOptions, fieldConfig: panel.fieldConfig, transparent: panel.transparent, width: innerWidth, height: innerHeight, renderCounter: renderCounter, replaceVariables: panel.replaceVariables, onOptionsChange: this.onOptionsChange, onFieldConfigChange: this.onFieldConfigChange, onChangeTimeRange: this.onChangeTimeRange, eventBus: dashboard.events }),
                config.featureToggles.panelMonitoring && this.state.errorMessage === undefined && (React.createElement(PanelLoadTimeMonitor, { panelType: plugin.meta.id, panelId: panel.id, panelTitle: panel.title })))));
    }
    render() {
        var _a, _b;
        const { dashboard, panel, width, height, plugin } = this.props;
        const { errorMessage, data } = this.state;
        const { transparent } = panel;
        const panelChromeProps = getPanelChromeProps(Object.assign(Object.assign({}, this.props), { data }));
        // Shift the hover menu down if it's on the top row so it doesn't get clipped by topnav
        const hoverHeaderOffset = ((_b = (_a = panel.gridPos) === null || _a === void 0 ? void 0 : _a.y) !== null && _b !== void 0 ? _b : 0) === 0 ? -16 : undefined;
        const menu = (React.createElement("div", { "data-testid": "panel-dropdown" },
            React.createElement(PanelHeaderMenuWrapper, { panel: panel, dashboard: dashboard, loadingState: data.state })));
        return (React.createElement(PanelChrome, { width: width, height: height, title: panelChromeProps.title, loadingState: data.state, statusMessage: errorMessage, statusMessageOnClick: panelChromeProps.onOpenErrorInspect, description: panelChromeProps.description, titleItems: panelChromeProps.titleItems, menu: this.props.hideMenu ? undefined : menu, dragClass: panelChromeProps.dragClass, dragClassCancel: "grid-drag-cancel", padding: panelChromeProps.padding, hoverHeaderOffset: hoverHeaderOffset, hoverHeader: panelChromeProps.hasOverlayHeader(), displayMode: transparent ? 'transparent' : 'default', onCancelQuery: panelChromeProps.onCancelQuery, onOpenMenu: panelChromeProps.onOpenMenu }, (innerWidth, innerHeight) => (React.createElement(React.Fragment, null,
            React.createElement(ErrorBoundary, { dependencies: [data, plugin, panel.getOptions()], onError: this.onPanelError, onRecover: this.onPanelErrorRecover }, ({ error }) => {
                if (error) {
                    return null;
                }
                return this.renderPanelContent(innerWidth, innerHeight);
            })))));
    }
}
//# sourceMappingURL=PanelStateWrapper.js.map