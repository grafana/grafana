///<reference path="../../headers/common.d.ts" />

import config from 'app/core/config';
import angular from 'angular';
import moment from 'moment';
import _ from 'lodash';

import coreModule from 'app/core/core_module';

export class DashboardCtrl {

  /** @ngInject */
  constructor(
    private $scope,
    private $rootScope,
    dashboardKeybindings,
    timeSrv,
    variableSrv,
    alertingSrv,
    dashboardSrv,
    unsavedChangesSrv,
    dynamicDashboardSrv,
    dashboardViewStateSrv,
    contextSrv,
    alertSrv,
    $timeout) {

      $scope.editor = { index: 0 };
      $scope.panels = config.panels;

      var resizeEventTimeout;

      $scope.setupDashboard = function(data) {
        try {
          $scope.setupDashboardInternal(data);
        } catch (err) {
          $scope.onInitFailed(err, 'Dashboard init failed', true);
        }
      };

      $scope.setupDashboardInternal = function(data) {
        var dashboard = dashboardSrv.create(data.dashboard, data.meta);
        dashboardSrv.setCurrent(dashboard);

        // init services
        timeSrv.init(dashboard);
        alertingSrv.init(dashboard, data.alerts);

        // template values service needs to initialize completely before
        // the rest of the dashboard can load
        variableSrv.init(dashboard)
        // template values failes are non fatal
        .catch($scope.onInitFailed.bind(this, 'Templating init failed', false))
        // continue
        .finally(function() {
          dynamicDashboardSrv.init(dashboard, variableSrv);
          dynamicDashboardSrv.process();

          unsavedChangesSrv.init(dashboard, $scope);

          $scope.dashboard = dashboard;
          $scope.dashboardMeta = dashboard.meta;
          $scope.dashboardViewState = dashboardViewStateSrv.create($scope);

          dashboardKeybindings.shortcuts($scope);

          $scope.updateSubmenuVisibility();
          $scope.setWindowTitleAndTheme();

          $scope.appEvent("dashboard-initialized", $scope.dashboard);
        })
        .catch($scope.onInitFailed.bind(this, 'Dashboard init failed', true));
      };

      $scope.onInitFailed = function(msg, fatal, err) {
        console.log(msg, err);

        if (err.data && err.data.message) {
          err.message = err.data.message;
        } else if (!err.message) {
          err = {message: err.toString()};
        }

        $scope.appEvent("alert-error", [msg, err.message]);

        // protect against  recursive fallbacks
        if (fatal && !$scope.loadedFallbackDashboard) {
          $scope.loadedFallbackDashboard = true;
          $scope.setupDashboard({dashboard: {title: 'Dashboard Init failed'}});
        }
      };

      $scope.templateVariableUpdated = function() {
        dynamicDashboardSrv.process();
      };

      $scope.updateSubmenuVisibility = function() {
        $scope.submenuEnabled = $scope.dashboard.isSubmenuFeaturesEnabled();
      };

      $scope.setWindowTitleAndTheme = function() {
        window.document.title = config.window_title_prefix + $scope.dashboard.title;
      };

      $scope.broadcastRefresh = function() {
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

      $scope.showJsonEditor = function(evt, options) {
        var editScope = $rootScope.$new();
        editScope.object = options.object;
        editScope.updateHandler = options.updateHandler;
        $scope.appEvent('show-dash-editor', { src: 'public/app/partials/edit_json.html', scope: editScope });
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
        } else {
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

      $scope.timezoneChanged = function() {
        $rootScope.$broadcast("refresh");
      };
    }

    init(dashboard) {
      this.$scope.resetRow();
      this.$scope.registerWindowResizeEvent();
      this.$scope.onAppEvent('show-json-editor', this.$scope.showJsonEditor);
      this.$scope.onAppEvent('template-variable-value-updated', this.$scope.templateVariableUpdated);
      this.$scope.setupDashboard(dashboard);
    }
}

coreModule.controller('DashboardCtrl', DashboardCtrl);
