///<reference path="../../../headers/common.d.ts" />

import './graph';
import './legend';
import './seriesOverridesCtrl';

import moment from 'moment';
import kbn from 'app/core/utils/kbn';
import _ from 'lodash';
import TimeSeries from 'app/core/time_series2';
import * as fileExport from 'app/core/utils/file_export';
import {MetricsPanelCtrl} from 'app/plugins/sdk';

var panelDefaults = {
  // datasource name, null = default datasource
  datasource: null,
  // sets client side (flot) or native graphite png renderer (png)
  renderer: 'flot',
  // Show/hide the x-axis
  'x-axis'      : true,
  // Show/hide y-axis
  'y-axis'      : true,
  // y axis formats, [left axis,right axis]
  y_formats    : ['short', 'short'],
  // grid options
  grid          : {
    leftLogBase: 1,
    leftMax: null,
    rightMax: null,
    leftMin: null,
    rightMin: null,
    rightLogBase: 1,
    threshold1: null,
    threshold2: null,
    threshold1Color: 'rgba(216, 200, 27, 0.27)',
    threshold2Color: 'rgba(234, 112, 112, 0.22)'
  },
  // show/hide lines
  lines         : true,
  // fill factor
  fill          : 1,
  // line width in pixels
  linewidth     : 2,
  // show hide points
  points        : false,
  // point radius in pixels
  pointradius   : 5,
  // show hide bars
  bars          : false,
  // enable/disable stacking
  stack         : false,
  // stack percentage mode
  percentage    : false,
  // legend options
  legend: {
    show: true, // disable/enable legend
    values: false, // disable/enable legend values
    min: false,
    max: false,
    current: false,
    total: false,
    avg: false
  },
  // how null points should be handled
  nullPointMode : 'connected',
  // staircase line mode
  steppedLine: false,
  // tooltip options
  tooltip       : {
    value_type: 'cumulative',
    shared: true,
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
};

class GraphCtrl extends MetricsPanelCtrl {
  static templateUrl = 'module.html';

  hiddenSeries: any = {};
  seriesList: any = [];
  logScales: any;
  unitFormats: any;
  annotationsPromise: any;
  datapointsCount: number;
  datapointsOutside: boolean;
  datapointsWarning: boolean;
  colors: any = [];

  /** @ngInject */
  constructor($scope, $injector, private annotationsSrv) {
    super($scope, $injector);

    _.defaults(this.panel, panelDefaults);
    _.defaults(this.panel.tooltip, panelDefaults.tooltip);
    _.defaults(this.panel.grid, panelDefaults.grid);
    _.defaults(this.panel.legend, panelDefaults.legend);

    this.colors = $scope.$root.colors;
  }

  initEditMode() {
    super.initEditMode();

    this.icon = "fa fa-bar-chart";
    this.addEditorTab('Axes & Grid', 'public/app/plugins/panel/graph/axisEditor.html', 2);
    this.addEditorTab('Display Styles', 'public/app/plugins/panel/graph/styleEditor.html', 3);

    this.logScales = {
      'linear': 1,
      'log (base 2)': 2,
      'log (base 10)': 10,
      'log (base 32)': 32,
      'log (base 1024)': 1024
    };
    this.unitFormats = kbn.getUnitFormats();
  }

  getExtendedMenu() {
    var menu = super.getExtendedMenu();
    menu.push({text: 'Export CSV', click: 'ctrl.exportCsv()'});
    menu.push({text: 'Toggle legend', click: 'ctrl.toggleLegend()'});
    return menu;
  }

  setUnitFormat(axis, subItem) {
    this.panel.y_formats[axis] = subItem.value;
    this.render();
  }

  refreshData(datasource) {
    this.annotationsPromise = this.annotationsSrv.getAnnotations(this.dashboard);

    return this.issueQueries(datasource)
    .then(res => this.dataHandler(res))
    .catch(err => {
      this.seriesList = [];
      this.render([]);
      throw err;
    });
  }

  zoomOut(evt) {
    this.publishAppEvent('zoom-out', evt);
  }

  loadSnapshot(snapshotData) {
    this.annotationsPromise = this.annotationsSrv.getAnnotations(this.dashboard);
    this.dataHandler(snapshotData);
  }

  dataHandler(results) {
    // png renderer returns just a url
    if (_.isString(results)) {
      this.render(results);
      return;
    }

    this.datapointsWarning = false;
    this.datapointsCount = 0;
    this.datapointsOutside = false;
    this.seriesList = _.map(results.data, (series, i) => this.seriesHandler(series, i));
    this.datapointsWarning = this.datapointsCount === 0 || this.datapointsOutside;

    this.annotationsPromise.then(annotations => {
      this.loading = false;
      this.seriesList.annotations = annotations;
      this.render(this.seriesList);
    }, () => {
      this.loading = false;
      this.render(this.seriesList);
    });
  };

  seriesHandler(seriesData, index) {
    var datapoints = seriesData.datapoints;
    var alias = seriesData.target;
    var colorIndex = index % this.colors.length;
    var color = this.panel.aliasColors[alias] || this.colors[colorIndex];

    var series = new TimeSeries({
      datapoints: datapoints,
      alias: alias,
      color: color,
    });

    if (datapoints && datapoints.length > 0) {
      var last = moment.utc(datapoints[datapoints.length - 1][1]);
      var from = moment.utc(this.range.from);
      if (last - from < -10000) {
        this.datapointsOutside = true;
      }

      this.datapointsCount += datapoints.length;
    }

    return series;
  }

  render(data?: any) {
    this.broadcastRender(data);
  }

  changeSeriesColor(series, color) {
    series.color = color;
    this.panel.aliasColors[series.alias] = series.color;
    this.render();
  }

  toggleSeries(serie, event) {
    if (event.ctrlKey || event.metaKey || event.shiftKey) {
      if (this.hiddenSeries[serie.alias]) {
        delete this.hiddenSeries[serie.alias];
      } else {
        this.hiddenSeries[serie.alias] = true;
      }
    } else {
      this.toggleSeriesExclusiveMode(serie);
    }

    this.render();
  }

  toggleSeriesExclusiveMode (serie) {
    var hidden = this.hiddenSeries;

    if (hidden[serie.alias]) {
      delete hidden[serie.alias];
    }

    // check if every other series is hidden
    var alreadyExclusive = _.every(this.seriesList, value => {
      if (value.alias === serie.alias) {
        return true;
      }

      return hidden[value.alias];
    });

    if (alreadyExclusive) {
      // remove all hidden series
      _.each(this.seriesList, value => {
        delete this.hiddenSeries[value.alias];
      });
    } else {
      // hide all but this serie
      _.each(this.seriesList, value => {
        if (value.alias === serie.alias) {
          return;
        }

        this.hiddenSeries[value.alias] = true;
      });
    }
  }

  toggleYAxis(info) {
    var override = _.findWhere(this.panel.seriesOverrides, { alias: info.alias });
    if (!override) {
      override = { alias: info.alias };
      this.panel.seriesOverrides.push(override);
    }
    override.yaxis = info.yaxis === 2 ? 1 : 2;
    this.render();
  };

  addSeriesOverride(override) {
    this.panel.seriesOverrides.push(override || {});
  }

  removeSeriesOverride(override) {
    this.panel.seriesOverrides = _.without(this.panel.seriesOverrides, override);
    this.render();
  }

  // Called from panel menu
  toggleLegend() {
    this.panel.legend.show = !this.panel.legend.show;
    this.refresh();
  }

  legendValuesOptionChanged() {
    var legend = this.panel.legend;
    legend.values = legend.min || legend.max || legend.avg || legend.current || legend.total;
    this.render();
  }

  exportCsv() {
    fileExport.exportSeriesListToCsv(this.seriesList);
  }
}

export {GraphCtrl, GraphCtrl as PanelCtrl}
