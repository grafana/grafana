import './graph';
import './series_overrides_ctrl';
import './thresholds_form';
import './time_regions_form';
import './annotation_tooltip';
import './event_editor';
import { defaults, find, without } from 'lodash';
import { FieldConfigProperty, PanelEvents, PanelPlugin } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { MetricsPanelCtrl } from 'app/angular/panel/metrics_panel_ctrl';
import config from 'app/core/config';
import { ThresholdMapper } from 'app/features/alerting/state/ThresholdMapper';
import { changePanelPlugin } from 'app/features/panel/state/actions';
import { dispatch } from 'app/store/store';
import { appEvents } from '../../../core/core';
import { loadSnapshotData } from '../../../features/dashboard/utils/loadSnapshotData';
import { annotationsFromDataFrames } from '../../../features/query/state/DashboardQueryRunner/utils';
import { ZoomOutEvent } from '../../../types/events';
import { GraphContextMenuCtrl } from './GraphContextMenuCtrl';
import { graphPanelMigrationHandler } from './GraphMigrations';
import { axesEditorComponent } from './axes_editor';
import { DataProcessor } from './data_processor';
import template from './template';
import { getDataTimeRange } from './utils';
export class GraphCtrl extends MetricsPanelCtrl {
    constructor($scope, $injector) {
        super($scope, $injector);
        this.renderError = false;
        this.hiddenSeries = {};
        this.hiddenSeriesTainted = false;
        this.seriesList = [];
        this.dataList = [];
        this.annotations = [];
        this.colors = [];
        this.subTabIndex = 0;
        this.panelDefaults = {
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
        this.onColorChange = (series, color) => {
            series.setColor(config.theme2.visualization.getColorByName(color));
            this.panel.aliasColors[series.alias] = color;
            this.render();
        };
        this.onToggleSeries = (hiddenSeries) => {
            this.hiddenSeriesTainted = true;
            this.hiddenSeries = hiddenSeries;
            this.render();
        };
        this.onToggleSort = (sortBy, sortDesc) => {
            this.panel.legend.sort = sortBy;
            this.panel.legend.sortDesc = sortDesc;
            this.render();
        };
        this.onToggleAxis = (info) => {
            let override = find(this.panel.seriesOverrides, { alias: info.alias });
            if (!override) {
                override = { alias: info.alias };
                this.panel.seriesOverrides.push(override);
            }
            override.yaxis = info.yaxis;
            this.render();
        };
        this.onContextMenuClose = () => {
            this.contextMenuCtrl.toggleMenu();
        };
        this.getTimeZone = () => this.dashboard.getTimezone();
        this.getDataFrameByRefId = (refId) => {
            return this.dataList.filter((dataFrame) => dataFrame.refId === refId)[0];
        };
        defaults(this.panel, this.panelDefaults);
        defaults(this.panel.tooltip, this.panelDefaults.tooltip);
        defaults(this.panel.legend, this.panelDefaults.legend);
        defaults(this.panel.xaxis, this.panelDefaults.xaxis);
        defaults(this.panel.options, this.panelDefaults.options);
        this.useDataFrames = true;
        this.processor = new DataProcessor(this.panel);
        this.contextMenuCtrl = new GraphContextMenuCtrl($scope);
        this.events.on(PanelEvents.render, this.onRender.bind(this));
        this.events.on(PanelEvents.dataFramesReceived, this.onDataFramesReceived.bind(this));
        this.events.on(PanelEvents.dataSnapshotLoad, this.onDataSnapshotLoad.bind(this));
        this.events.on(PanelEvents.editModeInitialized, this.onInitEditMode.bind(this));
        this.events.on(PanelEvents.initPanelActions, this.onInitPanelActions.bind(this));
        // set axes format from field config
        const fieldConfigUnit = this.panel.fieldConfig.defaults.unit;
        if (fieldConfigUnit) {
            this.panel.yaxes[0].format = fieldConfigUnit;
        }
    }
    onInitEditMode() {
        this.addEditorTab('Display', 'public/app/plugins/panel/graph/tab_display.html');
        this.addEditorTab('Series overrides', 'public/app/plugins/panel/graph/tab_series_overrides.html');
        this.addEditorTab('Axes', axesEditorComponent);
        this.addEditorTab('Legend', 'public/app/plugins/panel/graph/tab_legend.html');
        this.addEditorTab('Thresholds', 'public/app/plugins/panel/graph/tab_thresholds.html');
        this.addEditorTab('Time regions', 'public/app/plugins/panel/graph/tab_time_regions.html');
        this.subTabIndex = 0;
        this.hiddenSeriesTainted = false;
    }
    onInitPanelActions(actions) {
        actions.push({ text: 'Toggle legend', click: 'ctrl.toggleLegend()', shortcut: 'p l' });
    }
    zoomOut(evt) {
        appEvents.publish(new ZoomOutEvent({ scale: 2 }));
    }
    onDataSnapshotLoad(snapshotData) {
        const { series, annotations } = loadSnapshotData(this.panel, this.dashboard);
        this.panelData.annotations = annotations;
        this.onDataFramesReceived(series);
    }
    onDataFramesReceived(data) {
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
    }
    getDataWarning() {
        var _a;
        const datapointsCount = this.seriesList.reduce((prev, series) => {
            return prev + series.datapoints.length;
        }, 0);
        if (datapointsCount === 0) {
            if (this.dataList) {
                for (const frame of this.dataList) {
                    if (frame.length && ((_a = frame.fields) === null || _a === void 0 ? void 0 : _a.length)) {
                        return {
                            title: 'Unable to graph data',
                            tip: 'Data exists, but is not timeseries',
                            actionText: 'Switch to table view',
                            action: () => {
                                dispatch(changePanelPlugin({ panel: this.panel, pluginId: 'table' }));
                            },
                        };
                    }
                }
            }
            return {
                title: 'No data',
                tip: 'No data returned from query',
            };
        }
        // If any data is in range, do not return an error
        for (const series of this.seriesList) {
            if (!series.isOutsideRange) {
                return undefined;
            }
        }
        // All data is outside the time range
        const dataWarning = {
            title: 'Data outside time range',
            tip: 'Can be caused by timezone mismatch or missing time filter in query',
        };
        const range = getDataTimeRange(this.dataList);
        if (range) {
            dataWarning.actionText = 'Zoom to data';
            dataWarning.action = () => {
                locationService.partial({
                    from: range.from,
                    to: range.to,
                });
            };
        }
        return dataWarning;
    }
    onRender() {
        if (!this.seriesList) {
            return;
        }
        ThresholdMapper.alertToGraphThresholds(this.panel);
        for (const series of this.seriesList) {
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
    addSeriesOverride(override) {
        this.panel.seriesOverrides.push(override || {});
    }
    removeSeriesOverride(override) {
        this.panel.seriesOverrides = without(this.panel.seriesOverrides, override);
        this.render();
    }
    toggleLegend() {
        this.panel.legend.show = !this.panel.legend.show;
        this.render();
    }
    legendValuesOptionChanged() {
        const legend = this.panel.legend;
        legend.values = legend.min || legend.max || legend.avg || legend.current || legend.total;
        this.render();
    }
    migrateToReact() {
        this.onPluginTypeChange(config.panels['timeseries']);
    }
}
GraphCtrl.template = template;
GraphCtrl.$inject = ['$scope', '$injector'];
// Use new react style configuration
export const plugin = new PanelPlugin(null)
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