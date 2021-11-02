import { __extends, __values } from "tslib";
import './graph';
import './series_overrides_ctrl';
import './thresholds_form';
import './time_regions_form';
import template from './template';
import { defaults, find, without } from 'lodash';
import { DataProcessor } from './data_processor';
import { axesEditorComponent } from './axes_editor';
import config from 'app/core/config';
import { FieldConfigProperty, getColorForTheme, PanelEvents, PanelPlugin } from '@grafana/data';
import { GraphContextMenuCtrl } from './GraphContextMenuCtrl';
import { graphPanelMigrationHandler } from './GraphMigrations';
import { getLocationSrv } from '@grafana/runtime';
import { getDataTimeRange } from './utils';
import { changePanelPlugin } from 'app/features/panel/state/actions';
import { dispatch } from 'app/store/store';
import { ThresholdMapper } from 'app/features/alerting/state/ThresholdMapper';
import { appEvents } from '../../../core/core';
import { ZoomOutEvent } from '../../../types/events';
import { MetricsPanelCtrl } from 'app/angular/panel/metrics_panel_ctrl';
import { loadSnapshotData } from '../../../features/dashboard/utils/loadSnapshotData';
import { annotationsFromDataFrames } from '../../../features/query/state/DashboardQueryRunner/utils';
var GraphCtrl = /** @class */ (function (_super) {
    __extends(GraphCtrl, _super);
    /** @ngInject */
    function GraphCtrl($scope, $injector) {
        var _this = _super.call(this, $scope, $injector) || this;
        _this.renderError = false;
        _this.hiddenSeries = {};
        _this.hiddenSeriesTainted = false;
        _this.seriesList = [];
        _this.dataList = [];
        _this.annotations = [];
        _this.colors = [];
        _this.subTabIndex = 0;
        _this.panelDefaults = {
            // datasource name, null = default datasource
            datasource: null,
            // sets client side (flot) or native graphite png renderer (png)
            renderer: 'flot',
            yaxes: [
                {
                    label: null,
                    show: true,
                    logBase: 1,
                    min: null,
                    max: null,
                    format: 'short',
                },
                {
                    label: null,
                    show: true,
                    logBase: 1,
                    min: null,
                    max: null,
                    format: 'short',
                },
            ],
            xaxis: {
                show: true,
                mode: 'time',
                name: null,
                values: [],
                buckets: null,
            },
            yaxis: {
                align: false,
                alignLevel: null,
            },
            // show/hide lines
            lines: true,
            // fill factor
            fill: 1,
            // fill gradient
            fillGradient: 0,
            // line width in pixels
            linewidth: 1,
            // show/hide dashed line
            dashes: false,
            // show/hide line
            hiddenSeries: false,
            // length of a dash
            dashLength: 10,
            // length of space between two dashes
            spaceLength: 10,
            // show hide points
            points: false,
            // point radius in pixels
            pointradius: 2,
            // show hide bars
            bars: false,
            // enable/disable stacking
            stack: false,
            // stack percentage mode
            percentage: false,
            // legend options
            legend: {
                show: true,
                values: false,
                min: false,
                max: false,
                current: false,
                total: false,
                avg: false,
            },
            // how null points should be handled
            nullPointMode: 'null',
            // staircase line mode
            steppedLine: false,
            // tooltip options
            tooltip: {
                value_type: 'individual',
                shared: true,
                sort: 0,
            },
            // time overrides
            timeFrom: null,
            timeShift: null,
            // metric queries
            targets: [{}],
            // series color overrides
            aliasColors: {},
            // other style overrides
            seriesOverrides: [],
            thresholds: [],
            timeRegions: [],
            options: {
                // show/hide alert threshold lines and fill
                alertThreshold: true,
            },
        };
        _this.onColorChange = function (series, color) {
            series.setColor(getColorForTheme(color, config.theme));
            _this.panel.aliasColors[series.alias] = color;
            _this.render();
        };
        _this.onToggleSeries = function (hiddenSeries) {
            _this.hiddenSeriesTainted = true;
            _this.hiddenSeries = hiddenSeries;
            _this.render();
        };
        _this.onToggleSort = function (sortBy, sortDesc) {
            _this.panel.legend.sort = sortBy;
            _this.panel.legend.sortDesc = sortDesc;
            _this.render();
        };
        _this.onToggleAxis = function (info) {
            var override = find(_this.panel.seriesOverrides, { alias: info.alias });
            if (!override) {
                override = { alias: info.alias };
                _this.panel.seriesOverrides.push(override);
            }
            override.yaxis = info.yaxis;
            _this.render();
        };
        _this.onContextMenuClose = function () {
            _this.contextMenuCtrl.toggleMenu();
        };
        _this.getTimeZone = function () { return _this.dashboard.getTimezone(); };
        _this.getDataFrameByRefId = function (refId) {
            return _this.dataList.filter(function (dataFrame) { return dataFrame.refId === refId; })[0];
        };
        defaults(_this.panel, _this.panelDefaults);
        defaults(_this.panel.tooltip, _this.panelDefaults.tooltip);
        defaults(_this.panel.legend, _this.panelDefaults.legend);
        defaults(_this.panel.xaxis, _this.panelDefaults.xaxis);
        defaults(_this.panel.options, _this.panelDefaults.options);
        _this.useDataFrames = true;
        _this.processor = new DataProcessor(_this.panel);
        _this.contextMenuCtrl = new GraphContextMenuCtrl($scope);
        _this.events.on(PanelEvents.render, _this.onRender.bind(_this));
        _this.events.on(PanelEvents.dataFramesReceived, _this.onDataFramesReceived.bind(_this));
        _this.events.on(PanelEvents.dataSnapshotLoad, _this.onDataSnapshotLoad.bind(_this));
        _this.events.on(PanelEvents.editModeInitialized, _this.onInitEditMode.bind(_this));
        _this.events.on(PanelEvents.initPanelActions, _this.onInitPanelActions.bind(_this));
        // set axes format from field config
        var fieldConfigUnit = _this.panel.fieldConfig.defaults.unit;
        if (fieldConfigUnit) {
            _this.panel.yaxes[0].format = fieldConfigUnit;
        }
        return _this;
    }
    GraphCtrl.prototype.onInitEditMode = function () {
        this.addEditorTab('Display', 'public/app/plugins/panel/graph/tab_display.html');
        this.addEditorTab('Series overrides', 'public/app/plugins/panel/graph/tab_series_overrides.html');
        this.addEditorTab('Axes', axesEditorComponent);
        this.addEditorTab('Legend', 'public/app/plugins/panel/graph/tab_legend.html');
        this.addEditorTab('Thresholds', 'public/app/plugins/panel/graph/tab_thresholds.html');
        this.addEditorTab('Time regions', 'public/app/plugins/panel/graph/tab_time_regions.html');
        this.subTabIndex = 0;
        this.hiddenSeriesTainted = false;
    };
    GraphCtrl.prototype.onInitPanelActions = function (actions) {
        actions.push({ text: 'Toggle legend', click: 'ctrl.toggleLegend()', shortcut: 'p l' });
    };
    GraphCtrl.prototype.zoomOut = function (evt) {
        appEvents.publish(new ZoomOutEvent(2));
    };
    GraphCtrl.prototype.onDataSnapshotLoad = function (snapshotData) {
        var _a = loadSnapshotData(this.panel, this.dashboard), series = _a.series, annotations = _a.annotations;
        this.panelData.annotations = annotations;
        this.onDataFramesReceived(series);
    };
    GraphCtrl.prototype.onDataFramesReceived = function (data) {
        var _a;
        this.dataList = data;
        this.seriesList = this.processor.getSeriesList({
            dataList: this.dataList,
            range: this.range,
        });
        this.dataWarning = this.getDataWarning();
        this.alertState = undefined;
        this.seriesList.alertState = undefined;
        if (this.panelData.alertState) {
            this.alertState = this.panelData.alertState;
            this.seriesList.alertState = this.alertState.state;
        }
        this.annotations = [];
        if ((_a = this.panelData.annotations) === null || _a === void 0 ? void 0 : _a.length) {
            this.annotations = annotationsFromDataFrames(this.panelData.annotations);
        }
        this.loading = false;
        this.render(this.seriesList);
    };
    GraphCtrl.prototype.getDataWarning = function () {
        var e_1, _a, e_2, _b;
        var _this = this;
        var _c;
        var datapointsCount = this.seriesList.reduce(function (prev, series) {
            return prev + series.datapoints.length;
        }, 0);
        if (datapointsCount === 0) {
            if (this.dataList) {
                try {
                    for (var _d = __values(this.dataList), _e = _d.next(); !_e.done; _e = _d.next()) {
                        var frame = _e.value;
                        if (frame.length && ((_c = frame.fields) === null || _c === void 0 ? void 0 : _c.length)) {
                            return {
                                title: 'Unable to graph data',
                                tip: 'Data exists, but is not timeseries',
                                actionText: 'Switch to table view',
                                action: function () {
                                    dispatch(changePanelPlugin({ panel: _this.panel, pluginId: 'table' }));
                                },
                            };
                        }
                    }
                }
                catch (e_1_1) { e_1 = { error: e_1_1 }; }
                finally {
                    try {
                        if (_e && !_e.done && (_a = _d.return)) _a.call(_d);
                    }
                    finally { if (e_1) throw e_1.error; }
                }
            }
            return {
                title: 'No data',
                tip: 'No data returned from query',
            };
        }
        try {
            // If any data is in range, do not return an error
            for (var _f = __values(this.seriesList), _g = _f.next(); !_g.done; _g = _f.next()) {
                var series = _g.value;
                if (!series.isOutsideRange) {
                    return undefined;
                }
            }
        }
        catch (e_2_1) { e_2 = { error: e_2_1 }; }
        finally {
            try {
                if (_g && !_g.done && (_b = _f.return)) _b.call(_f);
            }
            finally { if (e_2) throw e_2.error; }
        }
        // All data is outside the time range
        var dataWarning = {
            title: 'Data outside time range',
            tip: 'Can be caused by timezone mismatch or missing time filter in query',
        };
        var range = getDataTimeRange(this.dataList);
        if (range) {
            dataWarning.actionText = 'Zoom to data';
            dataWarning.action = function () {
                getLocationSrv().update({
                    partial: true,
                    query: {
                        from: range.from,
                        to: range.to,
                    },
                });
            };
        }
        return dataWarning;
    };
    GraphCtrl.prototype.onRender = function () {
        var e_3, _a;
        if (!this.seriesList) {
            return;
        }
        ThresholdMapper.alertToGraphThresholds(this.panel);
        try {
            for (var _b = __values(this.seriesList), _c = _b.next(); !_c.done; _c = _b.next()) {
                var series = _c.value;
                series.applySeriesOverrides(this.panel.seriesOverrides);
                // Always use the configured field unit
                if (series.unit) {
                    this.panel.yaxes[series.yaxis - 1].format = series.unit;
                }
                if (this.hiddenSeriesTainted === false && series.hiddenSeries === true) {
                    this.hiddenSeries[series.alias] = true;
                }
            }
        }
        catch (e_3_1) { e_3 = { error: e_3_1 }; }
        finally {
            try {
                if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
            }
            finally { if (e_3) throw e_3.error; }
        }
    };
    GraphCtrl.prototype.addSeriesOverride = function (override) {
        this.panel.seriesOverrides.push(override || {});
    };
    GraphCtrl.prototype.removeSeriesOverride = function (override) {
        this.panel.seriesOverrides = without(this.panel.seriesOverrides, override);
        this.render();
    };
    GraphCtrl.prototype.toggleLegend = function () {
        this.panel.legend.show = !this.panel.legend.show;
        this.render();
    };
    GraphCtrl.prototype.legendValuesOptionChanged = function () {
        var legend = this.panel.legend;
        legend.values = legend.min || legend.max || legend.avg || legend.current || legend.total;
        this.render();
    };
    GraphCtrl.template = template;
    return GraphCtrl;
}(MetricsPanelCtrl));
export { GraphCtrl };
// Use new react style configuration
export var plugin = new PanelPlugin(null)
    .useFieldConfig({
    disableStandardOptions: [
        FieldConfigProperty.NoValue,
        FieldConfigProperty.Thresholds,
        FieldConfigProperty.Max,
        FieldConfigProperty.Min,
        FieldConfigProperty.Decimals,
        FieldConfigProperty.Color,
        FieldConfigProperty.Mappings,
    ],
})
    .setDataSupport({ annotations: true, alertStates: true })
    .setMigrationHandler(graphPanelMigrationHandler);
// Use the angular ctrt rather than a react one
plugin.angularPanelCtrl = GraphCtrl;
//# sourceMappingURL=module.js.map