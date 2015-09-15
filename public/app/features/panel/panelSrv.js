define([
  'angular',
  'lodash',
  'config',
],
function (angular, _, config) {
  'use strict';

  var module = angular.module('grafana.services');

  module.service('panelSrv', function($rootScope, $timeout, datasourceSrv, $q) {

    this.init = function($scope) {

      if (!$scope.panel.span) { $scope.panel.span = 12; }

      $scope.inspector = {};

      $scope.editPanel = function() {
        $scope.toggleFullscreen(true);
      };

      $scope.sharePanel = function() {
        $scope.appEvent('show-modal', {
          src: './app/features/dashboard/partials/shareModal.html',
          scope: $scope.$new()
        });
      };

      $scope.editPanelJson = function() {
        $scope.appEvent('show-json-editor', { object: $scope.panel, updateHandler: $scope.replacePanel });
      };

      $scope.duplicatePanel = function() {
        $scope.dashboard.duplicatePanel($scope.panel, $scope.row);
      };

      $scope.updateColumnSpan = function(span) {
        $scope.updatePanelSpan($scope.panel, span);

        $timeout(function() {
          $scope.$broadcast('render');
        });
      };

      $scope.addDataQuery = function() {
        $scope.panel.targets.push({target: ''});
        $scope.$broadcast('addDataQuery', {targetID: $scope.panel.targets.length - 1});
      };

      $scope.removeDataQuery = function (query) {
        $scope.panel.targets = _.without($scope.panel.targets, query);
        $scope.$broadcast('removeDataQuery');
        $scope.get_data();
      };

      $scope.setDatasource = function(datasource) {
        $scope.panel.datasource = datasource;
        $scope.datasource = null;
        $scope.get_data();
      };

      $scope.toggleEditorHelp = function(index) {
        if ($scope.editorHelpIndex === index) {
          $scope.editorHelpIndex = null;
          return;
        }
        $scope.editorHelpIndex = index;
      };

      $scope.isNewPanel = function() {
        return $scope.panel.title === config.new_panel_title;
      };

      $scope.toggleFullscreen = function(edit) {
        $scope.dashboardViewState.update({ fullscreen: true, edit: edit, panelId: $scope.panel.id });
      };

      $scope.otherPanelInFullscreenMode = function() {
        return $scope.dashboardViewState.fullscreen && !$scope.fullscreen;
      };

      $scope.getCurrentDatasource = function() {
        if ($scope.datasource) {
          return $q.when($scope.datasource);
        }

        return datasourceSrv.get($scope.panel.datasource);
      };

      $scope.panelRenderingComplete = function() {
        $rootScope.performance.panelsRendered++;
      };

      $scope.get_data = function() {
        if ($scope.otherPanelInFullscreenMode()) { return; }

        if ($scope.panel.snapshotData) {
          if ($scope.loadSnapshot) {
            $scope.loadSnapshot($scope.panel.snapshotData);
          }
          return;
        }

        delete $scope.panelMeta.error;
        $scope.panelMeta.loading = true;

        $scope.getCurrentDatasource().then(function(datasource) {
          $scope.datasource = datasource;
          return $scope.refreshData($scope.datasource) || $q.when({});
        }).then(function() {
          $scope.panelMeta.loading = false;
        }, function(err) {
          console.log('Panel data error:', err);
          $scope.panelMeta.loading = false;
          $scope.panelMeta.error = err.message || "Timeseries data request error";
          $scope.inspector.error = err;
        });
      };

      if ($scope.refreshData) {
        $scope.$on("refresh", $scope.get_data);
      }

      // Post init phase
      $scope.fullscreen = false;
      $scope.editor = { index: 1 };

      $scope.dashboardViewState.registerPanel($scope);
      $scope.datasources = datasourceSrv.getMetricSources();

      if (!$scope.skipDataOnInit) {
        $timeout(function() {
          $scope.get_data();
        }, 30);
      }
    };
  });

});
