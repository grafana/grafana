define([
  'angular',
  'app',
  'lodash',
  'components/timeSeries',
  'kbn',
  'components/panelmeta',
  './singleStatPanel',
],
function (angular, app, _, TimeSeries, kbn, PanelMeta) {
  'use strict';

  var module = angular.module('grafana.panels.singlestat');
  app.useModule(module);

  module.directive('grafanaPanelSinglestat', function() {
    return {
      controller: 'SingleStatCtrl',
      templateUrl: 'app/panels/singlestat/module.html',
    };
  });

  module.controller('SingleStatCtrl', function($scope, panelSrv, panelHelper) {

    $scope.panelMeta = new PanelMeta({
      panelName: 'Singlestat',
      editIcon:  "fa fa-dashboard",
      fullscreen: true,
      metricsEditor: true
    });

    $scope.fontSizes = ['20%', '30%','50%','70%','80%','100%', '110%', '120%', '150%', '170%', '200%'];

    $scope.panelMeta.addEditorTab('Options', 'app/panels/singlestat/editor.html');
    $scope.panelMeta.addEditorTab('Time range', 'app/features/panel/partials/panelTime.html');

    // Set and populate defaults
    var _d = {
      links: [],
      maxDataPoints: 100,
      interval: null,
      targets: [{}],
      cacheTimeout: null,
      format: 'none',
      image: '',
      prefix: '',
      postfix: '',
      nullText: null,
      valueMaps: [
        { value: 'null', op: '=', text: 'N/A' }
      ],
      nullPointMode: 'connected',
      valueName: 'avg',
      imageFontSize: '50%',
      prefixFontSize: '50%',
      valueFontSize: '80%',
      postfixFontSize: '50%',
      thresholds: '',
      colorBackground: false,
      colorValue: false,
      colors: ["rgba(245, 54, 54, 0.9)", "rgba(237, 129, 40, 0.89)", "rgba(50, 172, 45, 0.97)"],
      sparkline: {
        show: false,
        full: false,
        lineColor: 'rgb(31, 120, 193)',
        fillColor: 'rgba(31, 118, 189, 0.18)',
      }
    };

    _.defaults($scope.panel, _d);
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

    $scope.loadSnapshot = function(snapshotData) {
      panelHelper.updateTimeRange($scope);
      $scope.dataHandler(snapshotData);
    };

    $scope.dataHandler = function(results) {
      $scope.series = _.map(results.data, $scope.seriesHandler);
      $scope.render();
    };

    $scope.seriesHandler = function(seriesData) {
      var series = new TimeSeries({
        datapoints: seriesData.datapoints,
        alias: seriesData.target,
      });

      series.flotpairs = series.getFlotPairs($scope.panel.nullPointMode);

      return series;
    };

    $scope.setColoring = function(options) {
      if (options.background) {
        $scope.panel.colorValue = false;
        $scope.panel.colors = ['rgba(71, 212, 59, 0.4)', 'rgba(245, 150, 40, 0.73)', 'rgba(225, 40, 40, 0.59)'];
      }
      else {
        $scope.panel.colorBackground = false;
        $scope.panel.colors = ['rgba(50, 172, 45, 0.97)', 'rgba(237, 129, 40, 0.89)', 'rgba(245, 54, 54, 0.9)'];
      }
      $scope.render();
    };

    $scope.invertColorOrder = function() {
      var tmp = $scope.panel.colors[0];
      $scope.panel.colors[0] = $scope.panel.colors[2];
      $scope.panel.colors[2] = tmp;
      $scope.render();
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
      var data = {};

      if (!$scope.series || $scope.series.length === 0) {
        data.flotpairs = [];
        data.mainValue = Number.NaN;
        data.mainValueFormated = $scope.getFormatedValue(null);
      }
      else {
        var series = $scope.series[0];
        data.mainValue = series.stats[$scope.panel.valueName];
        data.mainValueFormated = $scope.getFormatedValue(data.mainValue);
        data.flotpairs = series.flotpairs;
      }

      data.thresholds = $scope.panel.thresholds.split(',').map(function(strVale) {
        return Number(strVale.trim());
      });

      data.colorMap = $scope.panel.colors;

      $scope.data = data;
      $scope.$broadcast('render');
    };

    $scope.getFormatedValue = function(mainValue) {

      // first check value to text mappings
      for(var i = 0; i < $scope.panel.valueMaps.length; i++) {
        var map = $scope.panel.valueMaps[i];
        // special null case
        if (map.value === 'null') {
          if (mainValue === null || mainValue === void 0) {
            return map.text;
          }
          continue;
        }
        // value/number to text mapping
        var value = parseFloat(map.value);
        if (value === mainValue) {
          return map.text;
        }
      }

      if (mainValue === null || mainValue === void 0) {
        return "no value";
      }

      var decimalInfo = $scope.getDecimalsForValue(mainValue);
      var formatFunc = kbn.valueFormats[$scope.panel.format];
      return formatFunc(mainValue, decimalInfo.decimals, decimalInfo.scaledDecimals);
    };

    $scope.removeValueMap = function(map) {
      var index = _.indexOf($scope.panel.valueMaps, map);
      $scope.panel.valueMaps.splice(index, 1);
      $scope.render();
    };

    $scope.addValueMap = function() {
      $scope.panel.valueMaps.push({value: '', op: '=', text: '' });
    };

    $scope.init();
  });
});
