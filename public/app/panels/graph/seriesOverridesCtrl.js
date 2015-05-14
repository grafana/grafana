define([
  'angular',
  'jquery',
  'app',
  'lodash',
], function(angular, jquery, app, _) {
  'use strict';

  var module = angular.module('grafana.panels.graph', []);
  app.useModule(module);

  module.controller('SeriesOverridesCtrl', function($scope, $element, popoverSrv) {
    $scope.overrideMenu = [];
    $scope.currentOverrides = [];
    $scope.override = $scope.override || {};

    $scope.addOverrideOption = function(name, propertyName, values) {
      var option = {};
      option.text = name;
      option.propertyName = propertyName;
      option.index = $scope.overrideMenu.length;
      option.values = values;

      option.submenu = _.map(values, function(value) {
        return { text: String(value), value: value };
      });

      $scope.overrideMenu.push(option);
    };

    $scope.setOverride = function(item, subItem) {
      // handle color overrides
      if (item.propertyName === 'color') {
        $scope.openColorSelector();
        return;
      }

      $scope.override[item.propertyName] = subItem.value;

      // automatically disable lines for this series and the fill bellow to series
      // can be removed by the user if they still want lines
      if (item.propertyName === 'fillBelowTo') {
        $scope.override['lines'] = false;
        $scope.addSeriesOverride({ alias: subItem.value, lines: false });
      }

      $scope.updateCurrentOverrides();
      $scope.render();
    };

    $scope.colorSelected = function(color) {
      $scope.override['color'] = color;
      $scope.updateCurrentOverrides();
      $scope.render();
    };

    $scope.openColorSelector = function() {
      var popoverScope = $scope.$new();
      popoverScope.colorSelected = $scope.colorSelected;

      popoverSrv.show({
        element: $element.find(".dropdown"),
        placement: 'top',
        templateUrl:  'app/partials/colorpicker.html',
        scope: popoverScope
      });
    };

    $scope.removeOverride = function(option) {
      delete $scope.override[option.propertyName];
      $scope.updateCurrentOverrides();
      $scope.render();
    };

    $scope.getSeriesNames = function() {
      return _.map($scope.seriesList, function(series) {
        return series.alias;
      });
    };

    $scope.updateCurrentOverrides = function() {
      $scope.currentOverrides = [];
      _.each($scope.overrideMenu, function(option) {
        var value = $scope.override[option.propertyName];
        if (_.isUndefined(value)) { return; }
        $scope.currentOverrides.push({
          name: option.text,
          propertyName: option.propertyName,
          value: String(value)
        });
      });
    };

    $scope.addOverrideOption('Bars', 'bars', [true, false]);
    $scope.addOverrideOption('Lines', 'lines', [true, false]);
    $scope.addOverrideOption('Line fill', 'fill', [0,1,2,3,4,5,6,7,8,9,10]);
    $scope.addOverrideOption('Line width', 'linewidth', [0,1,2,3,4,5,6,7,8,9,10]);
    $scope.addOverrideOption('Fill below to', 'fillBelowTo', $scope.getSeriesNames());
    $scope.addOverrideOption('Staircase line', 'steppedLine', [true, false]);
    $scope.addOverrideOption('Points', 'points', [true, false]);
    $scope.addOverrideOption('Points Radius', 'pointradius', [1,2,3,4,5]);
    $scope.addOverrideOption('Stack', 'stack', [true, false, 2, 3, 4, 5]);
    $scope.addOverrideOption('Color', 'color', ['change']);
    $scope.addOverrideOption('Y-axis', 'yaxis', [1, 2]);
    $scope.addOverrideOption('Z-index', 'zindex', [-1,-2,-3,0,1,2,3]);
    $scope.updateCurrentOverrides();

  });

});
