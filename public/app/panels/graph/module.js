define([
  'angular',
  'lodash',
  'moment',
  'app/core/utils/kbn',
  'app/core/time_series',
  'app/features/panel/panel_meta',
  './seriesOverridesCtrl',
  './graph',
  './legend',
],
function (angular, _, moment, kbn, TimeSeries, PanelMeta) {
  'use strict';

  var module = angular.module('grafana.panels.graph');

  module.directive('grafanaPanelGraph', function() {
    return {
      controller: 'GraphCtrl',
      templateUrl: 'app/panels/graph/module.html',
    };
  });

  module.controller('GraphCtrl', function($scope, $rootScope, panelSrv, annotationsSrv, panelHelper, $q) {

    $scope.panelMeta = new PanelMeta({
      panelName: 'Graph',
      editIcon:  "fa fa-bar-chart",
      fullscreen: true,
      metricsEditor: true,
    });

    $scope.panelMeta.addEditorTab('Axes & Grid', 'app/panels/graph/axisEditor.html');
    $scope.panelMeta.addEditorTab('Display Styles', 'app/panels/graph/styleEditor.html');
    $scope.panelMeta.addEditorTab('Time range', 'app/features/panel/partials/panelTime.html');

    $scope.panelMeta.addExtendedMenuItem('Export CSV', '', 'exportCsv()');
    $scope.panelMeta.addExtendedMenuItem('Toggle legend', '', 'toggleLegend()');

    // Set and populate defaults
    var _d = {
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
        percent: false,
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

    _.defaults($scope.panel,_d);
    _.defaults($scope.panel.tooltip, _d.tooltip);
    _.defaults($scope.panel.annotate, _d.annotate);
    _.defaults($scope.panel.grid, _d.grid);
    _.defaults($scope.panel.legend, _d.legend);

    $scope.logScales = {'linear': 1, 'log (base 2)': 2, 'log (base 10)': 10, 'log (base 32)': 32, 'log (base 1024)': 1024};

    $scope.hiddenSeries = {};
    $scope.seriesList = [];
    $scope.unitFormats = kbn.getUnitFormats();

    $scope.setUnitFormat = function(axis, subItem) {
      $scope.panel.y_formats[axis] = subItem.value;
      $scope.render();
    };

    $scope.refreshData = function(datasource) {
      panelHelper.updateTimeRange($scope);

      $scope.annotationsPromise = annotationsSrv.getAnnotations($scope.dashboard);

      return panelHelper.issueMetricQuery($scope, datasource)
        .then($scope.dataHandler, function(err) {
          $scope.seriesList = [];
          $scope.render([]);
          throw err;
        });
    };

    $scope.loadSnapshot = function(snapshotData) {
      panelHelper.updateTimeRange($scope);
      $scope.annotationsPromise = $q.when([]);
      $scope.dataHandler(snapshotData);
    };

    $scope.dataHandler = function(results) {
      // png renderer returns just a url
      if (_.isString(results)) {
        $scope.render(results);
        return;
      }

      $scope.datapointsWarning = false;
      $scope.datapointsCount = 0;
      $scope.datapointsOutside = false;

      $scope.seriesList = _.map(results.data, $scope.seriesHandler);

      $scope.datapointsWarning = $scope.datapointsCount === 0 || $scope.datapointsOutside;

      $scope.annotationsPromise
        .then(function(annotations) {
          $scope.panelMeta.loading = false;
          $scope.seriesList.annotations = annotations;
          $scope.render($scope.seriesList);
        }, function() {
          $scope.panelMeta.loading = false;
          $scope.render($scope.seriesList);
        });
    };

    $scope.seriesHandler = function(seriesData, index) {
      var datapoints = seriesData.datapoints;
      var alias = seriesData.target;
      var colorIndex = index % $rootScope.colors.length;
      var color = $scope.panel.aliasColors[alias] || $rootScope.colors[colorIndex];

      var series = new TimeSeries({
        datapoints: datapoints,
        alias: alias,
        color: color,
      });

      if (datapoints && datapoints.length > 0) {
        var last = moment.utc(datapoints[datapoints.length - 1][1]);
        var from = moment.utc($scope.range.from);
        if (last - from < -10000) {
          $scope.datapointsOutside = true;
        }

        $scope.datapointsCount += datapoints.length;
      }

      return series;
    };

    $scope.render = function(data) {
      panelHelper.broadcastRender($scope, data);
    };

    $scope.changeSeriesColor = function(series, color) {
      series.color = color;
      $scope.panel.aliasColors[series.alias] = series.color;
      $scope.render();
    };

    $scope.toggleSeries = function(serie, event) {
      if (event.ctrlKey || event.metaKey || event.shiftKey) {
        if ($scope.hiddenSeries[serie.alias]) {
          delete $scope.hiddenSeries[serie.alias];
        }
        else {
          $scope.hiddenSeries[serie.alias] = true;
        }
      } else {
        $scope.toggleSeriesExclusiveMode(serie);
      }

      $scope.render();
    };

    $scope.toggleSeriesExclusiveMode = function(serie) {
      var hidden = $scope.hiddenSeries;

      if (hidden[serie.alias]) {
        delete hidden[serie.alias];
      }

      // check if every other series is hidden
      var alreadyExclusive = _.every($scope.seriesList, function(value) {
        if (value.alias === serie.alias) {
          return true;
        }

        return hidden[value.alias];
      });

      if (alreadyExclusive) {
        // remove all hidden series
        _.each($scope.seriesList, function(value) {
          delete $scope.hiddenSeries[value.alias];
        });
      }
      else {
        // hide all but this serie
        _.each($scope.seriesList, function(value) {
          if (value.alias === serie.alias) {
            return;
          }

          $scope.hiddenSeries[value.alias] = true;
        });
      }
    };

    $scope.toggleYAxis = function(info) {
      var override = _.findWhere($scope.panel.seriesOverrides, { alias: info.alias });
      if (!override) {
        override = { alias: info.alias };
        $scope.panel.seriesOverrides.push(override);
      }
      override.yaxis = info.yaxis === 2 ? 1 : 2;
      $scope.render();
    };

    $scope.addSeriesOverride = function(override) {
      $scope.panel.seriesOverrides.push(override || {});
    };

    $scope.removeSeriesOverride = function(override) {
      $scope.panel.seriesOverrides = _.without($scope.panel.seriesOverrides, override);
      $scope.render();
    };

    // Called from panel menu
    $scope.toggleLegend = function() {
      $scope.panel.legend.show = !$scope.panel.legend.show;
      $scope.get_data();
    };

    $scope.legendValuesOptionChanged = function() {
      var legend = $scope.panel.legend;
      legend.values = legend.min || legend.max || legend.avg || legend.current || legend.percent || legend.total;
      $scope.render();
    };

    $scope.exportCsv = function() {
      kbn.exportSeriesListToCsv($scope.seriesList);
    };

    panelSrv.init($scope);

  });

});
