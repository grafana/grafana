define([
  'angular',
  'jquery',
  'app/core/config',
  'lodash',
],
function (angular, $, config, _) {
  "use strict";

  var module = angular.module('grafana.controllers');

  module.controller('DashboardCtrl', function(
      $scope,
      $rootScope,
      dashboardKeybindings,
      timeSrv,
      templateValuesSrv,
      dynamicDashboardSrv,
      dashboardSrv,
      datasourceSrv,
      unsavedChangesSrv,
      dashboardViewStateSrv,
      contextSrv,
      $timeout) {

    $scope.editor = { index: 0 };
    $scope.topNavPartial = 'app/features/dashboard/partials/dashboardTopNav.html';
    $scope.panels = config.panels;

    var resizeEventTimeout;

    this.init = function(dashboard) {
      $scope.resetRow();
      $scope.registerWindowResizeEvent();
      $scope.onAppEvent('show-json-editor', $scope.showJsonEditor);
      $scope.setupDashboard(dashboard);
    };

    $scope.setupDashboard = function(data) {
      $rootScope.performance.dashboardLoadStart = new Date().getTime();
      $rootScope.performance.panelsInitialized = 0;
      $rootScope.performance.panelsRendered = 0;

      $scope.initDynamicDatasources(data.dashboard);

      var dashboard = dashboardSrv.create(data.dashboard, data.meta);
      dashboardSrv.setCurrent(dashboard);

      // init services
      timeSrv.init(dashboard);

      // template values service needs to initialize completely before
      // the rest of the dashboard can load
      templateValuesSrv.init(dashboard).finally(function() {
        dynamicDashboardSrv.init(dashboard);
        unsavedChangesSrv.init(dashboard, $scope);

        $scope.dashboard = dashboard;
        $scope.dashboardMeta = dashboard.meta;
        $scope.dashboardViewState = dashboardViewStateSrv.create($scope);

        dashboardKeybindings.shortcuts($scope);

        $scope.updateTopNavPartial();
        $scope.updateSubmenuVisibility();
        $scope.setWindowTitleAndTheme();

        $scope.appEvent("dashboard-loaded", $scope.dashboard);
      }).catch(function(err) {
        if (err.data && err.data.message) { err.message = err.data.message; }
        $scope.appEvent("alert-error", ['Dashboard init failed', 'Template variables could not be initialized: ' + err.message]);
      });
    };

    $scope.initDynamicDatasources = function(dashboard) {
      datasourceSrv.resetDynamicDatasources();

      if (dashboard.templating) {
        _.each(dashboard.templating.list, function(variable) {
          if (variable.type === 'datasource') {
            datasourceSrv.addDynamicDatasource(variable.name, variable.current.value);
          }
        });
      }
    };

    $scope.updateTopNavPartial = function() {
      if ($scope.dashboard.meta.isSnapshot) {
        $scope.topNavPartial = 'app/features/dashboard/partials/snapshotTopNav.html';
      }
    };

    $scope.updateSubmenuVisibility = function() {
      $scope.submenuEnabled = $scope.dashboard.isSubmenuFeaturesEnabled();
    };

    $scope.setWindowTitleAndTheme = function() {
      window.document.title = config.window_title_prefix + $scope.dashboard.title;
    };

    $scope.broadcastRefresh = function() {
      $rootScope.performance.panelsRendered = 0;
      $rootScope.$broadcast('refresh');
    };

    $scope.addRow = function(dash, row) {
      dash.rows.push(row);
    };

    $scope.addRowDefault = function() {
      $scope.resetRow();
      $scope.row.title = 'New row';
      $scope.addRow($scope.dashboard, $scope.row);
    };

    $scope.resetRow = function() {
      $scope.row = {
        title: '',
        height: '250px',
        editable: true,
      };
    };

    $scope.panelEditorPath = function(type) {
      return 'app/' + config.panels[type].path + '/editor.html';
    };

    $scope.pulldownEditorPath = function(type) {
      return 'app/panels/'+type+'/editor.html';
    };

    $scope.showJsonEditor = function(evt, options) {
      var editScope = $rootScope.$new();
      editScope.object = options.object;
      editScope.updateHandler = options.updateHandler;
      $scope.appEvent('show-dash-editor', { src: 'app/partials/edit_json.html', scope: editScope });
    };

    $scope.onDrop = function(panelId, row, dropTarget) {
      var info = $scope.dashboard.getPanelInfoById(panelId);
      if (dropTarget) {
        var dropInfo = $scope.dashboard.getPanelInfoById(dropTarget.id);
        dropInfo.row.panels[dropInfo.index] = info.panel;
        info.row.panels[info.index] = dropTarget;
        var dragSpan = info.panel.span;
        info.panel.span = dropTarget.span;
        dropTarget.span = dragSpan;
      }
      else {
        info.row.panels.splice(info.index, 1);
        info.panel.span = 12 - $scope.dashboard.rowSpan(row);
        row.panels.push(info.panel);
      }

      $rootScope.$broadcast('render');
    };

    $scope.registerWindowResizeEvent = function() {
      angular.element(window).bind('resize', function() {
        $timeout.cancel(resizeEventTimeout);
        resizeEventTimeout = $timeout(function() { $scope.$broadcast('render'); }, 200);
      });
      $scope.$on('$destroy', function() {
        angular.element(window).unbind('resize');
      });
    };

  });

});
