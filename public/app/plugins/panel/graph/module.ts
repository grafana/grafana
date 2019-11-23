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
import { VariableSuggestion } from '@grafana/ui';
import { getProcessedDataFrames } from 'app/features/dashboard/state/runRequest';
import { getColorFromHexRgbOrName, PanelEvents, DataFrame, DataLink, DateTimeInput } from '@grafana/data';

import { GraphContextMenuCtrl } from './GraphContextMenuCtrl';
import { getDataLinksVariableSuggestions } from 'app/features/panel/panellinks/link_srv';

import { auto } from 'angular';
import { AnnotationsSrv } from 'app/features/annotations/all';
import { CoreEvents } from 'app/types';

class GraphCtrl extends MetricsPanelCtrl {
  static template = template;

  renderError: boolean;
  hiddenSeries: any = {};
  hiddenSeriesTainted = false;
  seriesList: TimeSeries[] = [];
  dataList: DataFrame[] = [];
  annotations: any = [];
  alertState: any;

  annotationsPromise: any;
  dataWarning: any;
  colors: any = [];
  subTabIndex: number;
  processor: DataProcessor;
  contextMenuCtrl: GraphContextMenuCtrl;
  linkVariableSuggestions: VariableSuggestion[] = [];

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
    // fill factor
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
      dataLinks: [],
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
    this.events.on(CoreEvents.dataFramesReceived, this.onDataFramesReceived.bind(this));
    this.events.on(PanelEvents.dataSnapshotLoad, this.onDataSnapshotLoad.bind(this));
    this.events.on(PanelEvents.editModeInitialized, this.onInitEditMode.bind(this));
    this.events.on(PanelEvents.initPanelActions, this.onInitPanelActions.bind(this));

    this.onDataLinksChange = this.onDataLinksChange.bind(this);
  }

  onInitEditMode() {
    this.addEditorTab('Display options', 'public/app/plugins/panel/graph/tab_display.html');
    this.addEditorTab('Axes', axesEditorComponent);
    this.addEditorTab('Legend', 'public/app/plugins/panel/graph/tab_legend.html');
    this.addEditorTab('Thresholds & Time Regions', 'public/app/plugins/panel/graph/tab_thresholds_time_regions.html');
    this.addEditorTab('Data links', 'public/app/plugins/panel/graph/tab_drilldown_links.html');
    this.subTabIndex = 0;
    this.hiddenSeriesTainted = false;
  }

  onInitPanelActions(actions: any[]) {
    actions.push({ text: 'Export CSV', click: 'ctrl.exportCsv()' });
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

    this.linkVariableSuggestions = getDataLinksVariableSuggestions(data);

    this.dataWarning = null;
    const datapointsCount = this.seriesList.reduce((prev, series) => {
      return prev + series.datapoints.length;
    }, 0);

    if (datapointsCount === 0) {
      this.dataWarning = {
        title: 'No data',
        tip: 'No data returned from query',
      };
    } else {
      for (const series of this.seriesList) {
        if (series.isOutsideRange) {
          this.dataWarning = {
            title: 'Data outside time range',
            tip: 'Can be caused by timezone mismatch or missing time filter in query',
          };
          break;
        }
      }
    }

    this.annotationsPromise.then(
      (result: { alertState: any; annotations: any }) => {
        this.loading = false;
        this.alertState = result.alertState;
        this.annotations = result.annotations;
        this.render(this.seriesList);
      },
      () => {
        this.loading = false;
        this.render(this.seriesList);
      }
    );
  }

  onRender() {
    if (!this.seriesList) {
      return;
    }

    for (const series of this.seriesList) {
      series.applySeriesOverrides(this.panel.seriesOverrides);

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

  onDataLinksChange(dataLinks: DataLink[]) {
    this.panel.updateOptions({
      ...this.panel.options,
      dataLinks,
    });
  }

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

  exportCsv() {
    const scope = this.$scope.$new(true);
    scope.seriesList = this.seriesList;
    this.publishAppEvent(CoreEvents.showModal, {
      templateHtml: '<export-data-modal data="seriesList"></export-data-modal>',
      scope,
      modalClass: 'modal--narrow',
    });
  }

  onContextMenuClose = () => {
    this.contextMenuCtrl.toggleMenu();
  };

  formatDate = (date: DateTimeInput, format?: string) => {
    return this.dashboard.formatDate.apply(this.dashboard, [date, format]);
  };

  getDataFrameByRefId = (refId: string) => {
    return this.dataList.filter(dataFrame => dataFrame.refId === refId)[0];
  };
}

export { GraphCtrl, GraphCtrl as PanelCtrl };
