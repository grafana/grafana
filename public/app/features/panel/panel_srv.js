define([
  'angular',
  'lodash',
  'app/core/config',
],
function (angular, _, config) {
  'use strict';

  var module = angular.module('grafana.services');

  module.service('panelSrv', function($rootScope, $timeout, datasourceSrv, $q, $location, healthSrv, contextSrv, alertSrv, integrateSrv) {

    this.init = function($scope) {

      if (!$scope.panel.span) { $scope.panel.span = 12; }

      $scope.menuItemShow = false;

      $scope.inspector = {};

      $scope.showRightMenu = function() {
        $scope.menuItemShow = !$scope.menuItemShow;
      };

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

      $scope.addDataQuery = function(datasource) {
        $scope.dashboard.addDataQueryTo($scope.panel, datasource);
      };

      $scope.removeDataQuery = function (query) {
        $scope.dashboard.removeDataQuery($scope.panel, query);
        $scope.get_data();
      };

      $scope.duplicateDataQuery = function(query) {
        $scope.dashboard.duplicateDataQuery($scope.panel, query);
      };

      $scope.moveDataQuery = function(fromIndex, toIndex) {
        $scope.dashboard.moveDataQuery($scope.panel, fromIndex, toIndex);
      };

      $scope.setDatasource = function(datasource) {
        // switching to mixed
        if (datasource.meta.mixed) {
          _.each($scope.panel.targets, function(target) {
            target.datasource = $scope.panel.datasource;
            if (target.datasource === null) {
              target.datasource = config.defaultDatasource;
            }
          });
        }
        // switching from mixed
        else if ($scope.datasource && $scope.datasource.meta.mixed) {
          _.each($scope.panel.targets, function(target) {
            delete target.datasource;
          });
        }

        $scope.panel.datasource = datasource.value;
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

      $scope.decompose = function() {
        $scope.dashboardViewState.update({ fullscreen: false, edit: false, panelId: null });
        window.decomposeTarget = $scope.panel.targets[0];
        $location.path("/decompose");
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
        $scope.panelMeta.info = false;
        $scope.getCurrentDatasource().then(function (datasource) {
          $scope.datasource = datasource;
          return $scope.refreshData($scope.datasource) || $q.when({});
        }).then(function () {
          $scope.panelMeta.loading = false;
          $scope.panelMenuInit($scope.panel);
        }, function (err) {
          console.log('Panel data error:', err);
          $scope.panelMeta.loading = false;
          $scope.panelMeta.loading = false;
          $scope.panelMeta.error = err.message || "Timeseries data request error";
          $scope.inspector.error = err;
        });
      };

      $scope.isShowInfo = function (event) {
        if (event.type === "click") {
          $scope.helpShow = true;
        } else {
          $scope.helpShow = false;
        }
      };

      $scope.panelMenuInit = function (panel) {
        $scope.helpInfo = panel.helpInfo;
        $scope.showMenu = (panel.type == "graph") && ($scope.panelMeta.loading == false ? true : false);
        var path = $location.path();
        $scope.associateMenu = panel.lines && (/^\/anomaly/.test(path) || (/^\/integrate/.test(path)));
        $scope.integrateMenu = $scope.showMenu && !(/^\/integrate/.test(path)) && panel.lines;
      };
      $scope.associateLink = function () {
        try {
          var host = $scope.panel.targets[0].tags.host;
          var metric = $scope.panel.targets[0].metric;
          if (host && metric) {
            var link = '/alerts/association/' + host + '/100/' + contextSrv.user.orgId + '.' + contextSrv.user.systemId + '.' + metric;
            $location.path(link);
          }
        } catch (err) {
          var reg = /\'(.*?)\'/g;
          var msg = "图表中缺少" + err.toString().match(reg)[0] + "配置";
          $scope.appEvent('alert-warning', ['参数缺失', msg]);
        }
      };

      if ($scope.refreshData) {
        $scope.$on("refresh", $scope.get_data);
      }

      // Post init phase
      $scope.fullscreen = false;
      $scope.editor = { index: "概要" };

      $scope.dashboardViewState.registerPanel($scope);
      $scope.datasources = datasourceSrv.getMetricSources();

      if (!$scope.skipDataOnInit) {
        $timeout(function() {
          $scope.get_data();
        }, 30);
      }

      $scope.toIntegrate = function() {
        try{
          integrateSrv.options.targets = _.cloneDeep($scope.panel.targets);
          integrateSrv.options.title = $scope.panel.title;
          if (!$scope.panel.targets[0].metric) {
            integrateSrv.options.targets[0].metric = "*";
          }
          if (!_.isNull($scope.panel.targets[0].tags)) {
            integrateSrv.options.targets[0].tags = {host: "*"};
          }
          $location.path("/integrate");
        }catch(e){
          $scope.appEvent('alert-warning', ['日志分析跳转失败', '可能缺少指标名']);
        }
      };

      $scope.tabs = [
        {
          "title": "Home",
          "content": "Raw denim you probably haven't heard of them jean shorts Austin. Nesciunt tofu stumptown aliqua, retro synth master cleanse. Mustache cliche tempor, williamsburg carles vegan helvetica."
        },
        {
          "title": "Profile",
          "content": "Food truck fixie locavore, accusamus mcsweeney's marfa nulla single-origin coffee squid. Exercitation +1 labore velit, blog sartorial PBR leggings next level wes anderson artisan four loko farm-to-table craft beer twee."
        },
        {
          "title": "About",
          "content": "Etsy mixtape wayfarers, ethical wes anderson tofu before they sold out mcsweeney's organic lomo retro fanny pack lo-fi farm-to-table readymade.",
          "disabled": true
        }
      ];
      $scope.tabs.activeTab = "Home";
    };
  });

});