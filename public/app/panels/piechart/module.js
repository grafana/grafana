define([
  'angular',
  'app/app',
  'lodash',
  'kbn',
  'app/components/timeSeries',
  'app/components/panelmeta',
  './pieChartPanel',
  './legend',
],
function (angular, app, _, kbn, TimeSeries, PanelMeta) {
  'use strict';

  var module = angular.module('grafana.panels.piechart');
  app.useModule(module);

  module.directive('grafanaPanelPiechart', function() {
    return {
      controller: 'PieChartCtrl',
      templateUrl: 'app/panels/piechart/module.html',
    };
  });

  module.controller('PieChartCtrl', function($scope, $rootScope, panelSrv, panelHelper) {

    $scope.panelMeta = new PanelMeta({
      panelName: 'Piechart',
      editIcon:  "fa fa-dashboard",
      fullscreen: true,
      metricsEditor: true
    });

    $scope.panelMeta.addEditorTab('Options', 'app/panels/piechart/editor.html');
    $scope.panelMeta.addEditorTab('Time range', 'app/features/panel/partials/panelTime.html');

    // Set and populate defaults
    var _d = {
      pieType: 'pie',
      legend: {
        show: true, // disable/enable legend
        legendType: 'rightSide',
        values: false, // disable/enable legend values
        min: false,
        max: false,
        current: false,
        total: false,
        avg: false
      },
      links: [],
      datasource: null,
      maxDataPoints: 3,
      interval: null,
      targets: [{}],
      cacheTimeout: null,
      nullText: null,
      nullPointMode: 'connected'
    };

    _.defaults($scope.panel, _d);
    _.defaults($scope.panel.legend, _d.legend);

    $scope.unitFormats = kbn.getUnitFormats();

    $scope.setUnitFormat = function(subItem) {
      $scope.panel.format = subItem.value;
      $scope.render();
    };

    $scope.init = function() {
      panelSrv.init($scope);
    };

    $scope.refreshData = function(datasource) {
      panelHelper.updateTimeRange($scope);

      return panelHelper.issueMetricQuery($scope, datasource)
        .then($scope.dataHandler, function(err) {
          $scope.series = [];
          $scope.render();
          throw err;
        });
    };

    $scope.dataHandler = function(results) {
      $scope.series = _.map(results.data, $scope.seriesHandler);
      $scope.render();
    };

    $scope.seriesHandler = function(seriesData) {
      var series = new TimeSeries({
        datapoints: seriesData.datapoints,
        alias: seriesData.target
      });

      series.flotpairs = series.getFlotPairs($scope.panel.nullPointMode);

      return series;
    };

    $scope.getDecimalsForValue = function(value) {
      if (_.isNumber($scope.panel.decimals)) {
        return { decimals: $scope.panel.decimals, scaledDecimals: null };
      }

      var delta = value / 2;
      var dec = -Math.floor(Math.log(delta) / Math.LN10);

      var magn = Math.pow(10, -dec),
          norm = delta / magn, // norm is between 1.0 and 10.0
          size;

      if (norm < 1.5) {
        size = 1;
      } else if (norm < 3) {
        size = 2;
        // special case for 2.5, requires an extra decimal
        if (norm > 2.25) {
          size = 2.5;
          ++dec;
        }
      } else if (norm < 7.5) {
        size = 5;
      } else {
        size = 10;
      }

      size *= magn;

      // reduce starting decimals if not needed
      if (Math.floor(value) === value) { dec = 0; }

      var result = {};
      result.decimals = Math.max(0, dec);
      result.scaledDecimals = result.decimals - Math.floor(Math.log(size) / Math.LN10) + 2;

      return result;
    };

    $scope.render = function() {
      var data = [];

      if ($scope.series && $scope.series.length > 0) {
        for (var i=0; i < $scope.series.length; i++) {
          data.push({label: $scope.series[i].alias, data: $scope.series[i].stats.current, color: $rootScope.colors[i]});
        }
      }

      $scope.data = data;
      panelHelper.broadcastRender($scope, data);
    };

    $scope.setValues = function(data) {
      data.flotpairs = [];

      if ($scope.series && $scope.series.length > 0) {
        var lastPoint = _.last($scope.series[0].datapoints);
        var lastValue = _.isArray(lastPoint) ? lastPoint[0] : null;

        if (_.isString(lastValue)) {
          data.value = 0;
          data.valueFormated = lastValue;
          data.valueRounded = 0;
        } else {
          data.value = $scope.series[0].stats[$scope.panel.valueName];
          data.flotpairs = $scope.series[0].flotpairs;

          var decimalInfo = $scope.getDecimalsForValue(data.value);
          var formatFunc = kbn.valueFormats[$scope.panel.format];
          data.valueFormated = formatFunc(data.value, decimalInfo.decimals, decimalInfo.scaledDecimals);
          data.valueRounded = kbn.roundValue(data.value, decimalInfo.decimals);
        }
      }

      if (data.value === null || data.value === void 0) {
        data.valueFormated = "no value";
      }
    };

    $scope.removeValueMap = function(map) {
      var index = _.indexOf($scope.panel.valueMaps, map);
      $scope.panel.valueMaps.splice(index, 1);
      $scope.render();
    };

    $scope.addValueMap = function() {
      $scope.panel.valueMaps.push({value: '', op: '=', text: '' });
    };

    $scope.legendValuesOptionChanged = function() {
      var legend = $scope.panel.legend;
      legend.values = legend.min || legend.max || legend.avg || legend.current || legend.total;
      $scope.render();
    };

    $scope.init();
  });
});
