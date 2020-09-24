import './graph';
import './series_overrides_ctrl';
import './thresholds_form';
import './time_regions_form';

import template from './template';
import _ from 'lodash';

import { MetricsPanelCtrl } from 'app/plugins/sdk';
import { DataProcessor } from './data_processor';
import { axesEditorComponent } from './axes_editor';
import config from 'app/core/config';
import TimeSeries from 'app/core/time_series2';
import { getProcessedDataFrames } from 'app/features/dashboard/state/runRequest';
import { getColorFromHexRgbOrName, PanelEvents, PanelPlugin, DataFrame, FieldConfigProperty } from '@grafana/data';

import { GraphContextMenuCtrl } from './GraphContextMenuCtrl';
import { graphPanelMigrationHandler } from './GraphMigrations';
import { DataWarning, GraphPanelOptions, GraphFieldConfig } from './types';

import { auto } from 'angular';
import { AnnotationsSrv } from 'app/features/annotations/all';
import { CoreEvents } from 'app/types';
import { getLocationSrv } from '@grafana/runtime';
import { getDataTimeRange } from './utils';
import { changePanelPlugin } from 'app/features/dashboard/state/actions';
import { dispatch } from 'app/store/store';
import { ThresholdMapper } from 'app/features/alerting/state/ThresholdMapper';
import { getAnnotationsFromData } from 'app/features/annotations/standardAnnotationSupport';

export class GraphCtrl extends MetricsPanelCtrl {
  static template = template;

  renderError: boolean;
  hiddenSeries: any = {};
  hiddenSeriesTainted = false;
  seriesList: TimeSeries[] = [];
  dataList: DataFrame[] = [];
  annotations: any = [];
  alertState: any;

  annotationsPromise: any;
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
  constructor($scope: any, $injector: auto.IInjectorService, private annotationsSrv: AnnotationsSrv) {
    super($scope, $injector);

    _.defaults(this.panel, this.panelDefaults);
    _.defaults(this.panel.tooltip, this.panelDefaults.tooltip);
    _.defaults(this.panel.legend, this.panelDefaults.legend);
    _.defaults(this.panel.xaxis, this.panelDefaults.xaxis);
    _.defaults(this.panel.options, this.panelDefaults.options);

    this.useDataFrames = true;
    this.processor = new DataProcessor(this.panel);
    this.contextMenuCtrl = new GraphContextMenuCtrl($scope);

    this.events.on(PanelEvents.render, this.onRender.bind(this));
    this.events.on(PanelEvents.dataFramesReceived, this.onDataFramesReceived.bind(this));
    this.events.on(PanelEvents.dataSnapshotLoad, this.onDataSnapshotLoad.bind(this));
    this.events.on(PanelEvents.editModeInitialized, this.onInitEditMode.bind(this));
    this.events.on(PanelEvents.initPanelActions, this.onInitPanelActions.bind(this));

    this.annotationsPromise = Promise.resolve({ annotations: [] });
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
    this.annotationsPromise = this.annotationsSrv.getAnnotations({
      dashboard: this.dashboard,
      panel: this.panel,
      range: this.range,
    });

    /* Wait for annotationSrv requests to get datasources to
     * resolve before issuing queries. This allows the annotations
     * service to fire annotations queries before graph queries
     * (but not wait for completion). This resolves
     * issue 11806.
     */
    return this.annotationsSrv.datasourcePromises.then((r: any) => {
      return super.issueQueries(datasource);
    });
  }

  zoomOut(evt: any) {
    this.publishAppEvent(CoreEvents.zoomOut, 2);
  }

  onDataSnapshotLoad(snapshotData: any) {
    this.annotationsPromise = this.annotationsSrv.getAnnotations({
      dashboard: this.dashboard,
      panel: this.panel,
      range: this.range,
    });

    const frames = getProcessedDataFrames(snapshotData);
    this.onDataFramesReceived(frames);
  }

  onDataFramesReceived(data: DataFrame[]) {
    this.dataList = data;
    this.seriesList = this.processor.getSeriesList({
      dataList: this.dataList,
      range: this.range,
    });

    this.dataWarning = this.getDataWarning();

    this.annotationsPromise.then(
      (result: { alertState: any; annotations: any }) => {
        this.loading = false;
        this.alertState = result.alertState;
        this.annotations = result.annotations;

        // Temp alerting & react hack
        // Add it to the seriesList so react can access it
        if (this.alertState) {
          (this.seriesList as any).alertState = this.alertState.state;
        }

        if (this.panelData!.annotations?.length) {
          this.annotations = getAnnotationsFromData(this.panelData!.annotations!);
        }

        this.render(this.seriesList);
      },
      () => {
        this.loading = false;
        this.render(this.seriesList);
      }
    );
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
    series.setColor(getColorFromHexRgbOrName(color, config.theme.type));
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
    let override: any = _.find(this.panel.seriesOverrides, { alias: info.alias });
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
    this.panel.seriesOverrides = _.without(this.panel.seriesOverrides, override);
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
    return this.dataList.filter(dataFrame => dataFrame.refId === refId)[0];
  };
}

// Use new react style configuration
export const plugin = new PanelPlugin<GraphPanelOptions, GraphFieldConfig>(null)
  .useFieldConfig({
    standardOptions: [
      FieldConfigProperty.DisplayName,
      FieldConfigProperty.Unit,
      FieldConfigProperty.Links, // previously saved as dataLinks on options
    ],
  })
  .setMigrationHandler(graphPanelMigrationHandler);

// Use the angular ctrt rather than a react one
plugin.angularPanelCtrl = GraphCtrl;
