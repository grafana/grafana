import { __assign, __awaiter, __extends, __generator } from "tslib";
import React, { PureComponent } from 'react';
import classNames from 'classnames';
import { Subscription } from 'rxjs';
import { locationService, RefreshEvent } from '@grafana/runtime';
import { AnnotationChangeEvent, CoreApp, DashboardCursorSync, getDefaultTimeRange, LoadingState, toDataFrameDTO, toUtc, } from '@grafana/data';
import { ErrorBoundary, PanelContextProvider } from '@grafana/ui';
import { selectors } from '@grafana/e2e-selectors';
import { PanelHeader } from './PanelHeader/PanelHeader';
import { getTimeSrv } from '../services/TimeSrv';
import { applyPanelTimeOverrides } from 'app/features/dashboard/utils/panel';
import { profiler } from 'app/core/profiler';
import config from 'app/core/config';
import { PANEL_BORDER } from 'app/core/constants';
import { loadSnapshotData } from '../utils/loadSnapshotData';
import { RenderEvent } from 'app/types/events';
import { changeSeriesColorConfigFactory } from 'app/plugins/panel/timeseries/overrides/colorSeriesConfigFactory';
import { seriesVisibilityConfigFactory } from './SeriesVisibilityConfigFactory';
import { deleteAnnotation, saveAnnotation, updateAnnotation } from '../../annotations/api';
import { getDashboardQueryRunner } from '../../query/state/DashboardQueryRunner/DashboardQueryRunner';
import { liveTimer } from './liveTimer';
import { isSoloRoute } from '../../../routes/utils';
var DEFAULT_PLUGIN_ERROR = 'Error in plugin';
var PanelChrome = /** @class */ (function (_super) {
    __extends(PanelChrome, _super);
    function PanelChrome(props) {
        var _this = _super.call(this, props) || this;
        _this.timeSrv = getTimeSrv();
        _this.subs = new Subscription();
        _this.eventFilter = { onlyLocal: true };
        _this.onInstanceStateChange = function (value) {
            _this.props.onInstanceStateChange(value);
            _this.setState({
                context: __assign(__assign({}, _this.state.context), { instanceState: value }),
            });
        };
        _this.onSeriesColorChange = function (label, color) {
            _this.onFieldConfigChange(changeSeriesColorConfigFactory(label, color, _this.props.panel.fieldConfig));
        };
        _this.onSeriesVisibilityChange = function (label, mode) {
            _this.onFieldConfigChange(seriesVisibilityConfigFactory(label, mode, _this.props.panel.fieldConfig, _this.state.data.series));
        };
        _this.onToggleLegendSort = function (sortKey) {
            var legendOptions = _this.props.panel.options.legend;
            // We don't want to do anything when legend options are not available
            if (!legendOptions) {
                return;
            }
            var sortDesc = legendOptions.sortDesc;
            var sortBy = legendOptions.sortBy;
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
            _this.onOptionsChange(__assign(__assign({}, _this.props.panel.options), { legend: __assign(__assign({}, legendOptions), { sortBy: sortBy, sortDesc: sortDesc }) }));
        };
        _this.onRefresh = function () {
            var _a = _this.props, panel = _a.panel, isInView = _a.isInView, width = _a.width;
            if (!isInView) {
                _this.setState({ refreshWhenInView: true });
                return;
            }
            var timeData = applyPanelTimeOverrides(panel, _this.timeSrv.timeRange());
            // Issue Query
            if (_this.wantsQueryExecution) {
                if (width < 0) {
                    return;
                }
                if (_this.state.refreshWhenInView) {
                    _this.setState({ refreshWhenInView: false });
                }
                panel.runAllPanelQueries(_this.props.dashboard.id, _this.props.dashboard.getTimezone(), timeData, width);
            }
            else {
                // The panel should render on refresh as well if it doesn't have a query, like clock panel
                _this.setState({
                    data: __assign(__assign({}, _this.state.data), { timeRange: _this.timeSrv.timeRange() }),
                    renderCounter: _this.state.renderCounter + 1,
                    liveTime: undefined,
                });
            }
        };
        _this.onRender = function () {
            var stateUpdate = { renderCounter: _this.state.renderCounter + 1 };
            _this.setState(stateUpdate);
        };
        _this.onOptionsChange = function (options) {
            _this.props.panel.updateOptions(options);
        };
        _this.onFieldConfigChange = function (config) {
            _this.props.panel.updateFieldConfig(config);
        };
        _this.onPanelError = function (error) {
            var errorMessage = error.message || DEFAULT_PLUGIN_ERROR;
            if (_this.state.errorMessage !== errorMessage) {
                _this.setState({ errorMessage: errorMessage });
            }
        };
        _this.onPanelErrorRecover = function () {
            _this.setState({ errorMessage: undefined });
        };
        _this.onAnnotationCreate = function (event) { return __awaiter(_this, void 0, void 0, function () {
            var isRegion, anno;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        isRegion = event.from !== event.to;
                        anno = {
                            dashboardId: this.props.dashboard.id,
                            panelId: this.props.panel.id,
                            isRegion: isRegion,
                            time: event.from,
                            timeEnd: isRegion ? event.to : 0,
                            tags: event.tags,
                            text: event.description,
                        };
                        return [4 /*yield*/, saveAnnotation(anno)];
                    case 1:
                        _a.sent();
                        getDashboardQueryRunner().run({ dashboard: this.props.dashboard, range: this.timeSrv.timeRange() });
                        this.state.context.eventBus.publish(new AnnotationChangeEvent(anno));
                        return [2 /*return*/];
                }
            });
        }); };
        _this.onAnnotationDelete = function (id) { return __awaiter(_this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, deleteAnnotation({ id: id })];
                    case 1:
                        _a.sent();
                        getDashboardQueryRunner().run({ dashboard: this.props.dashboard, range: this.timeSrv.timeRange() });
                        this.state.context.eventBus.publish(new AnnotationChangeEvent({ id: id }));
                        return [2 /*return*/];
                }
            });
        }); };
        _this.onAnnotationUpdate = function (event) { return __awaiter(_this, void 0, void 0, function () {
            var isRegion, anno;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        isRegion = event.from !== event.to;
                        anno = {
                            id: event.id,
                            dashboardId: this.props.dashboard.id,
                            panelId: this.props.panel.id,
                            isRegion: isRegion,
                            time: event.from,
                            timeEnd: isRegion ? event.to : 0,
                            tags: event.tags,
                            text: event.description,
                        };
                        return [4 /*yield*/, updateAnnotation(anno)];
                    case 1:
                        _a.sent();
                        getDashboardQueryRunner().run({ dashboard: this.props.dashboard, range: this.timeSrv.timeRange() });
                        this.state.context.eventBus.publish(new AnnotationChangeEvent(anno));
                        return [2 /*return*/];
                }
            });
        }); };
        _this.onChangeTimeRange = function (timeRange) {
            _this.timeSrv.setTime({
                from: toUtc(timeRange.from),
                to: toUtc(timeRange.to),
            });
        };
        // Can this eventBus be on PanelModel?  when we have more complex event filtering, that may be a better option
        var eventBus = props.dashboard.events.newScopedBus("panel:" + props.panel.id, _this.eventFilter);
        _this.state = {
            isFirstLoad: true,
            renderCounter: 0,
            refreshWhenInView: false,
            context: {
                eventBus: eventBus,
                sync: props.isEditing ? DashboardCursorSync.Off : props.dashboard.graphTooltip,
                app: _this.getPanelContextApp(),
                onSeriesColorChange: _this.onSeriesColorChange,
                onToggleSeriesVisibility: _this.onSeriesVisibilityChange,
                onAnnotationCreate: _this.onAnnotationCreate,
                onAnnotationUpdate: _this.onAnnotationUpdate,
                onAnnotationDelete: _this.onAnnotationDelete,
                canAddAnnotations: function () { return Boolean(props.dashboard.meta.canEdit || props.dashboard.meta.canMakeEditable); },
                onInstanceStateChange: _this.onInstanceStateChange,
                onToggleLegendSort: _this.onToggleLegendSort,
            },
            data: _this.getInitialPanelDataState(),
        };
        return _this;
    }
    PanelChrome.prototype.getPanelContextApp = function () {
        if (this.props.isEditing) {
            return CoreApp.PanelEditor;
        }
        if (this.props.isViewing) {
            return CoreApp.PanelViewer;
        }
        return CoreApp.Dashboard;
    };
    PanelChrome.prototype.getInitialPanelDataState = function () {
        return {
            state: LoadingState.NotStarted,
            series: [],
            timeRange: getDefaultTimeRange(),
        };
    };
    PanelChrome.prototype.componentDidMount = function () {
        var _this = this;
        var _a = this.props, panel = _a.panel, dashboard = _a.dashboard;
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
            next: function (data) { return _this.onDataUpdate(data); },
        }));
        // Listen for live timer events
        liveTimer.listen(this);
    };
    PanelChrome.prototype.componentWillUnmount = function () {
        this.subs.unsubscribe();
        liveTimer.remove(this);
    };
    PanelChrome.prototype.liveTimeChanged = function (liveTime) {
        var data = this.state.data;
        if (data.timeRange) {
            var delta = liveTime.to.valueOf() - data.timeRange.to.valueOf();
            if (delta < 100) {
                // 10hz
                console.log('Skip tick render', this.props.panel.title, delta);
                return;
            }
        }
        this.setState({ liveTime: liveTime });
    };
    PanelChrome.prototype.componentDidUpdate = function (prevProps) {
        var _a = this.props, isInView = _a.isInView, isEditing = _a.isEditing, width = _a.width;
        var context = this.state.context;
        var app = this.getPanelContextApp();
        var sync = isEditing ? DashboardCursorSync.Off : this.props.dashboard.graphTooltip;
        if (context.sync !== sync || context.app !== app) {
            this.setState({
                context: __assign(__assign({}, context), { sync: sync, app: app }),
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
    };
    // Updates the response with information from the stream
    // The next is outside a react synthetic event so setState is not batched
    // So in this context we can only do a single call to setState
    PanelChrome.prototype.onDataUpdate = function (data) {
        var _a = this.props, dashboard = _a.dashboard, panel = _a.panel, plugin = _a.plugin;
        // Ignore this data update if we are now a non data panel
        if (plugin.meta.skipDataQuery) {
            this.setState({ data: this.getInitialPanelDataState() });
            return;
        }
        var isFirstLoad = this.state.isFirstLoad;
        var errorMessage;
        switch (data.state) {
            case LoadingState.Loading:
                // Skip updating state data if it is already in loading state
                // This is to avoid rendering partial loading responses
                if (this.state.data.state === LoadingState.Loading) {
                    return;
                }
                break;
            case LoadingState.Error:
                var error = data.error;
                if (error) {
                    if (errorMessage !== error.message) {
                        errorMessage = error.message;
                    }
                }
                break;
            case LoadingState.Done:
                // If we are doing a snapshot save data in panel model
                if (dashboard.snapshot) {
                    panel.snapshotData = data.series.map(function (frame) { return toDataFrameDTO(frame); });
                }
                if (isFirstLoad) {
                    isFirstLoad = false;
                }
                break;
        }
        this.setState({ isFirstLoad: isFirstLoad, errorMessage: errorMessage, data: data, liveTime: undefined });
    };
    Object.defineProperty(PanelChrome.prototype, "hasPanelSnapshot", {
        get: function () {
            var panel = this.props.panel;
            return panel.snapshotData && panel.snapshotData.length;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(PanelChrome.prototype, "wantsQueryExecution", {
        get: function () {
            return !(this.props.plugin.meta.skipDataQuery || this.hasPanelSnapshot);
        },
        enumerable: false,
        configurable: true
    });
    PanelChrome.prototype.shouldSignalRenderingCompleted = function (loadingState, pluginMeta) {
        return loadingState === LoadingState.Done || pluginMeta.skipDataQuery;
    };
    PanelChrome.prototype.skipFirstRender = function (loadingState) {
        var isFirstLoad = this.state.isFirstLoad;
        return (this.wantsQueryExecution &&
            isFirstLoad &&
            (loadingState === LoadingState.Loading || loadingState === LoadingState.NotStarted));
    };
    PanelChrome.prototype.renderPanel = function (width, height) {
        var _a, _b;
        var _c = this.props, panel = _c.panel, plugin = _c.plugin, dashboard = _c.dashboard;
        var _d = this.state, renderCounter = _d.renderCounter, data = _d.data;
        var theme = config.theme;
        var loadingState = data.state;
        // do not render component until we have first data
        if (this.skipFirstRender(loadingState)) {
            return null;
        }
        // This is only done to increase a counter that is used by backend
        // image rendering to know when to capture image
        if (this.shouldSignalRenderingCompleted(loadingState, plugin.meta)) {
            profiler.renderingCompleted();
        }
        var PanelComponent = plugin.panel;
        var timeRange = (_b = (_a = this.state.liveTime) !== null && _a !== void 0 ? _a : data.timeRange) !== null && _b !== void 0 ? _b : this.timeSrv.timeRange();
        var headerHeight = this.hasOverlayHeader() ? 0 : theme.panelHeaderHeight;
        var chromePadding = plugin.noPadding ? 0 : theme.panelPadding;
        var panelWidth = width - chromePadding * 2 - PANEL_BORDER;
        var innerPanelHeight = height - headerHeight - chromePadding * 2 - PANEL_BORDER;
        var panelContentClassNames = classNames({
            'panel-content': true,
            'panel-content--no-padding': plugin.noPadding,
        });
        var panelOptions = panel.getOptions();
        // Update the event filter (dashboard settings may have changed)
        // Yes this is called ever render for a function that is triggered on every mouse move
        this.eventFilter.onlyLocal = dashboard.graphTooltip === 0;
        return (React.createElement(React.Fragment, null,
            React.createElement("div", { className: panelContentClassNames },
                React.createElement(PanelContextProvider, { value: this.state.context },
                    React.createElement(PanelComponent, { id: panel.id, data: data, title: panel.title, timeRange: timeRange, timeZone: this.props.dashboard.getTimezone(), options: panelOptions, fieldConfig: panel.fieldConfig, transparent: panel.transparent, width: panelWidth, height: innerPanelHeight, renderCounter: renderCounter, replaceVariables: panel.replaceVariables, onOptionsChange: this.onOptionsChange, onFieldConfigChange: this.onFieldConfigChange, onChangeTimeRange: this.onChangeTimeRange, eventBus: dashboard.events })))));
    };
    PanelChrome.prototype.hasOverlayHeader = function () {
        var panel = this.props.panel;
        var data = this.state.data;
        // always show normal header if we have time override
        if (data.request && data.request.timeInfo) {
            return false;
        }
        return !panel.hasTitle();
    };
    PanelChrome.prototype.render = function () {
        var _a;
        var _this = this;
        var _b;
        var _c = this.props, dashboard = _c.dashboard, panel = _c.panel, isViewing = _c.isViewing, isEditing = _c.isEditing, width = _c.width, height = _c.height, plugin = _c.plugin;
        var _d = this.state, errorMessage = _d.errorMessage, data = _d.data;
        var transparent = panel.transparent;
        var alertState = (_b = data.alertState) === null || _b === void 0 ? void 0 : _b.state;
        var containerClassNames = classNames((_a = {
                'panel-container': true,
                'panel-container--absolute': isSoloRoute(locationService.getLocation().pathname),
                'panel-container--transparent': transparent,
                'panel-container--no-title': this.hasOverlayHeader()
            },
            _a["panel-alert-state--" + alertState] = alertState !== undefined,
            _a));
        return (React.createElement("section", { className: containerClassNames, "aria-label": selectors.components.Panels.Panel.containerByTitle(panel.title) },
            React.createElement(PanelHeader, { panel: panel, dashboard: dashboard, title: panel.title, description: panel.description, links: panel.links, error: errorMessage, isEditing: isEditing, isViewing: isViewing, alertState: alertState, data: data }),
            React.createElement(ErrorBoundary, { dependencies: [data, plugin, panel.getOptions()], onError: this.onPanelError, onRecover: this.onPanelErrorRecover }, function (_a) {
                var error = _a.error;
                if (error) {
                    return null;
                }
                return _this.renderPanel(width, height);
            })));
    };
    return PanelChrome;
}(PureComponent));
export { PanelChrome };
//# sourceMappingURL=PanelChrome.js.map