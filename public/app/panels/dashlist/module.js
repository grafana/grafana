define([
  'angular',
  'app/app',
  'lodash',
  'config',
  'app/components/panelmeta',
],
function (angular, app, _, config, PanelMeta) {
  'use strict';

  var module = angular.module('grafana.panels.dashlist', []);
  app.useModule(module);

  module.directive('grafanaPanelDashlist', function() {
    return {
      controller: 'DashListPanelCtrl',
      templateUrl: 'app/panels/dashlist/module.html',
    };
  });

  module.controller('DashListPanelCtrl', function($scope, panelSrv, backendSrv, healthSrv, contextSrv) {

    $scope.panelMeta = new PanelMeta({
      panelName: '仪表盘列表',
      editIcon:  "fa fa-star",
      fullscreen: true,
    });

    $scope.panelMeta.addEditorTab('Options', 'app/panels/dashlist/editor.html');

    var defaults = {
      mode: 'starred',
      query: '',
      limit: 10,
      tags: []
    };

    $scope.modes = ['starred', 'search'];

    _.defaults($scope.panel, defaults);

    $scope.dashList = [];

    $scope.init = function() {
      panelSrv.init($scope);

      if ($scope.panel.tag) {
        $scope.panel.tags = [$scope.panel.tag];
        delete $scope.panel.tag;
      }

      if ($scope.isNewPanel()) {
        $scope.panel.title = "关注的仪表盘";
      }
    };

    $scope.refreshData = function() {
      var params = {
        limit: $scope.panel.limit
      };

      if ($scope.panel.mode === 'starred') {
        params.starred = "true";
      } else {
        params.query = $scope.panel.query;
        params.tag = $scope.panel.tags;
      }

      return backendSrv.search(params).then(function (result) {
        healthSrv.healthSummary(contextSrv.user.orgName).then(function onSuccess(healthResult) {
          mappingHealth(result, healthResult.data);
          $scope.dashList = result;
          $scope.panelRenderingComplete();
        }, function onFailed() {
          $scope.dashList = result;
        });
      });
    };

    function mappingHealth(dataList, summaryMap) {
      _.each(dataList, function (target) {
        if (summaryMap[target.uri.split("/")[1]]) {
          target = $.extend(target, summaryMap[target.uri.split("/")[1]]);
          target.healthStyle = new Threshold100(target.health);
          target.alertStyle = new Threshold2(target.numAlertsTriggered);
        }
      });
    }

    function Threshold100(num) {
      var style = "btn-success";
      if (num < 77) {
        style = "btn-warning";
      } else if (num < 33) {
        style = "btn-danger";
      }
      return style;
    }

    function Threshold2(num) {
      var style = "btn-success";
      if (num > 0) {
        style = "btn-danger";
      }
      return style;
    }

    $scope.init();
  });
});
