define([
  'angular',
  'app/app',
  'lodash',
  'require',
  'app/features/panel/panel_meta',
],
function (angular, app, _, require, PanelMeta) {
  'use strict';

  var module = angular.module('grafana.panels.api', []);
  app.useModule(module);

  module.directive('grafanaPanelApi', function() {
    return {
      controller: 'ApiPanelCtrl',
      templateUrl: 'app/plugins/panels/api/module.html',
    };
  });

  module.controller('ApiPanelCtrl', function($scope, $http, templateSrv, $sce, panelSrv) {

    $scope.panelMeta = new PanelMeta({
      panelName: 'Api',
      editIcon:  "fa fa-text-width",
      fullscreen: true,
    });

    $scope.panelMeta.addEditorTab('Edit API Call', 'app/plugins/panels/api/editor.html');

    $scope.panel.verb = 'GET';

    $scope.init = function() {
      panelSrv.init($scope);
      $scope.ready = false;
      $scope.render();
    };

    $scope.refreshData = function() {
      $scope.panelMeta.loading = false;
      $scope.render();
    };

    $scope.render = function() {
      if ($scope.panel.url === undefined) {
        $scope.content = 'No data available';
      } else {

        var params = {
          method: $scope.panel.verb,
          url: $scope.panel.url,
        };

        if ($scope.panel.data !== '') {
          params.data = $scope.panel.data;
        }

        $http(params).then(function success(response) {

          if (response.data === undefined) {
            $scope.content = 'No data available';

          } else {

            if ($scope.panel.resp === undefined) {
              $scope.content = JSON.stringify(response.data);

            } else {

              var data = response.data;
              console.log($scope.panel.resp);
              if ($scope.panel.resp !== '')  {
                angular.forEach($scope.panel.resp.split('.'), function(key) {
                  data = data[key];
                });
              }
              $scope.content = JSON.stringify(data);
            }
          }
        });
      }
    };

    $scope.openEditor = function() {
    };

    $scope.init();
  });
});
