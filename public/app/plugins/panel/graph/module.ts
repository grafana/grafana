import './graph';
import './series_overrides_ctrl';
import './thresholds_form';
import './time_regions_form';

import template from './template';
import { defaults, find, without } from 'lodash';

import { DataProcessor } from './data_processor';
import { axesEditorComponent } from './axes_editor';
import config from 'app/core/config';
import TimeSeries from 'app/core/time_series2';
import { DataFrame, FieldConfigProperty, getColorForTheme, PanelEvents, PanelPlugin } from '@grafana/data';

import { GraphContextMenuCtrl } from './GraphContextMenuCtrl';
import { graphPanelMigrationHandler } from './GraphMigrations';
import { DataWarning, GraphFieldConfig, GraphPanelOptions } from './types';

import { auto } from 'angular';
import { getLocationSrv } from '@grafana/runtime';
import { getDataTimeRange } from './utils';
import { changePanelPlugin } from 'app/features/dashboard/state/actions';
import { dispatch } from 'app/store/store';
import { ThresholdMapper } from 'app/features/alerting/state/ThresholdMapper';
import { appEvents } from '../../../core/core';
import { ZoomOutEvent } from '../../../types/events';
import { MetricsPanelCtrl } from 'app/features/panel/metrics_panel_ctrl';
import { loadSnapshotData } from '../../../features/dashboard/utils/loadSnapshotData';
import { annotationsFromDataFrames } from '../../../features/query/state/DashboardQueryRunner/utils';

export class GraphCtrl extends MetricsPanelCtrl {
  static template = template;

  renderError: boolean;
  hiddenSeries: any = {};
  hiddenSeriesTainted = false;
  seriesList: TimeSeries[] = [];
  dataList: DataFrame[] = [];
  annotations: any = [];
  alertState: any;

  dataWarning?: DataWarning;
  colors: any = [];
  subTabIndex: number;
  processor: DataProcessor;
  contextMenuCtrl: GraphContextMenuCtrl;

  panelDefaults: any = {
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
      show: true, // disable/enable legend
      values: false, // disable/enable legend values
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

  /** @ngInject */
  constructor($scope: any, $injector: auto.IInjectorService) {
    super($scope, $injector);

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

  onInitPanelActions(actions: any[]) {
    actions.push({ text: 'Toggle legend', click: 'ctrl.toggleLegend()', shortcut: 'p l' });
  }

  issueQueries(datasource: any) {
    return super.issueQueries(datasource);
  }

  zoomOut(evt: any) {
    appEvents.publish(new ZoomOutEvent(2));
  }

  onDataSnapshotLoad(snapshotData: any) {
    const { series, annotations } = loadSnapshotData(this.panel, this.dashboard);
    this.panelData!.annotations = annotations;
    this.onDataFramesReceived(series);
  }

  onDataFramesReceived(data: DataFrame[]) {
    this.dataList = data;
    this.seriesList = this.processor.getSeriesList({
      dataList: this.dataList,
      range: this.range,
    });

    this.dataWarning = this.getDataWarning();

    this.alertState = undefined;
    (this.seriesList as any).alertState = undefined;
    if (this.panelData!.alertState) {
      this.alertState = this.panelData!.alertState;
      (this.seriesList as any).alertState = this.alertState.state;
    }

    this.annotations = [];
    if (this.panelData!.annotations?.length) {
      this.annotations = annotationsFromDataFrames(this.panelData!.annotations);
    }

    this.loading = false;
    this.render(this.seriesList);
  }

  getDataWarning(): DataWarning | undefined {
    const datapointsCount = this.seriesList.reduce((prev, series) => {
      return prev + series.datapoints.length;
    }, 0);

    if (datapointsCount === 0) {
      if (this.dataList) {
        for (const frame of this.dataList) {
          if (frame.length && frame.fields?.length) {
            return {
              title: 'Unable to graph data',
              tip: 'Data exists, but is not timeseries',
              actionText: 'Switch to table view',
              action: () => {
                dispatch(changePanelPlugin(this.panel, 'table'));
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
    const dataWarning: DataWarning = {
      title: 'Data outside time range',
      tip: 'Can be caused by timezone mismatch or missing time filter in query',
    };

    const range = getDataTimeRange(this.dataList);

    if (range) {
      dataWarning.actionText = 'Zoom to data';
      dataWarning.action = () => {
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

  onColorChange = (series: any, color: string) => {
    series.setColor(getColorForTheme(color, config.theme));
    this.panel.aliasColors[series.alias] = color;
    this.render();
  };

  onToggleSeries = (hiddenSeries: any) => {
    this.hiddenSeriesTainted = true;
    this.hiddenSeries = hiddenSeries;
    this.render();
  };

  onToggleSort = (sortBy: any, sortDesc: any) => {
    this.panel.legend.sort = sortBy;
    this.panel.legend.sortDesc = sortDesc;
    this.render();
  };

  onToggleAxis = (info: { alias: any; yaxis: any }) => {
    let override: any = find(this.panel.seriesOverrides, { alias: info.alias });
    if (!override) {
      override = { alias: info.alias };
      this.panel.seriesOverrides.push(override);
    }
    override.yaxis = info.yaxis;
    this.render();
  };

  addSeriesOverride(override: any) {
    this.panel.seriesOverrides.push(override || {});
  }

  removeSeriesOverride(override: any) {
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

  onContextMenuClose = () => {
    this.contextMenuCtrl.toggleMenu();
  };

  getTimeZone = () => this.dashboard.getTimezone();

  getDataFrameByRefId = (refId: string) => {
    return this.dataList.filter((dataFrame) => dataFrame.refId === refId)[0];
  };
}

// Use new react style configuration
export const plugin = new PanelPlugin<GraphPanelOptions, GraphFieldConfig>(null)
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
  .setMigrationHandler(graphPanelMigrationHandler);

// Use the angular ctrt rather than a react one
plugin.angularPanelCtrl = GraphCtrl;
