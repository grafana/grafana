///<reference path="../../../headers/common.d.ts" />

import _ from 'lodash';
import moment from 'moment';
import angular from 'angular';

import {DashboardExporter} from '../export/exporter';

export class DashNavCtrl {

  /** @ngInject */
  constructor($scope, $rootScope, dashboardSrv, $location, playlistSrv, backendSrv, $timeout, datasourceSrv) {

    $scope.init = function() {
      $scope.onAppEvent('save-dashboard', $scope.saveDashboard);
      $scope.onAppEvent('delete-dashboard', $scope.deleteDashboard);
      $scope.onAppEvent('quick-snapshot', $scope.quickSnapshot);

      $scope.showSettingsMenu = $scope.dashboardMeta.canEdit || $scope.contextSrv.isEditor;

      if ($scope.dashboardMeta.isSnapshot) {
        $scope.showSettingsMenu = false;
        var meta = $scope.dashboardMeta;
        $scope.titleTooltip = 'Created: &nbsp;' + moment(meta.created).calendar();
        if (meta.expires) {
          $scope.titleTooltip += '<br>Expires: &nbsp;' + moment(meta.expires).fromNow() + '<br>';
        }
      }
    };

    $scope.openEditView = function(editview) {
      var search = _.extend($location.search(), {editview: editview});
      $location.search(search);
    };

    $scope.showHelpModal = function() {
      $scope.appEvent('show-modal', {templateHtml: '<help-modal></help-modal>'});
    };

    $scope.starDashboard = function() {
      if ($scope.dashboardMeta.isStarred) {
        backendSrv.delete('/api/user/stars/dashboard/' + $scope.dashboard.id).then(function() {
          $scope.dashboardMeta.isStarred = false;
        });
      } else {
        backendSrv.post('/api/user/stars/dashboard/' + $scope.dashboard.id).then(function() {
          $scope.dashboardMeta.isStarred = true;
        });
      }
    };

    $scope.shareDashboard = function(tabIndex) {
      var modalScope = $scope.$new();
      modalScope.tabIndex = tabIndex;

      $scope.appEvent('show-modal', {
        src: 'public/app/features/dashboard/partials/shareModal.html',
        scope: modalScope
      });
    };

    $scope.quickSnapshot = function() {
      $scope.shareDashboard(1);
    };

    $scope.openSearch = function() {
      $scope.appEvent('show-dash-search');
    };

    $scope.hideTooltip = function(evt) {
      angular.element(evt.currentTarget).tooltip('hide');
      $scope.appEvent('hide-dash-search');
    };

    $scope.makeEditable = function() {
      $scope.dashboard.editable = true;

      return dashboardSrv.saveDashboard({makeEditable: true, overwrite: false}).then(function() {
        // force refresh whole page
        window.location.href = window.location.href;
      });
    };

    $scope.saveDashboard = function(options) {
      return dashboardSrv.saveDashboard(options);
    };

    $scope.deleteDashboard = function() {
      var confirmText = "";
      var text2 = $scope.dashboard.title;
      var alerts = $scope.dashboard.rows.reduce((memo, row) => {
        memo += row.panels.filter(panel => panel.alert).length;
        return memo;
      }, 0);

      if (alerts > 0) {
        confirmText = 'DELETE';
        text2 = `This dashboad contains ${alerts} alerts. Deleting this dashboad will also delete those alerts`;
      }

      $scope.appEvent('confirm-modal', {
        title: 'Delete',
        text: 'Do you want to delete this dashboard?',
        text2: text2,
        icon: 'fa-trash',
        confirmText: confirmText,
        yesText: 'Delete',
        onConfirm: function() {
          $scope.dashboardMeta.canSave = false;
          $scope.deleteDashboardConfirmed();
        }
      });
    };

    $scope.deleteDashboardConfirmed = function() {
      backendSrv.delete('/api/dashboards/db/' + $scope.dashboardMeta.slug).then(function() {
        $scope.appEvent('alert-success', ['Dashboard Deleted', $scope.dashboard.title + ' has been deleted']);
        $location.url('/');
      });
    };

    $scope.saveDashboardAs = function() {
      return dashboardSrv.saveDashboardAs();
    };

    $scope.viewJson = function() {
      var clone = $scope.dashboard.getSaveModelClone();
      var html = angular.toJson(clone, true);
      var uri = "data:application/json;charset=utf-8," + encodeURIComponent(html);
      var newWindow = window.open(uri);
    };

    $scope.snapshot = function() {
      $scope.dashboard.snapshot = true;
      $rootScope.$broadcast('refresh');

      $timeout(function() {
        $scope.dashboard.snapshot = false;
        $scope.appEvent('dashboard-snapshot-cleanup');
      }, 1000);

    };

    $scope.editJson = function() {
      var clone = $scope.dashboard.getSaveModelClone();
      $scope.appEvent('show-json-editor', { object: clone });
    };

    $scope.stopPlaylist = function() {
      playlistSrv.stop(1);
    };

    $scope.init();
  }
}

export function dashNavDirective() {
  return {
    restrict: 'E',
    templateUrl: 'public/app/features/dashboard/dashnav/dashnav.html',
    controller: DashNavCtrl,
    transclude: true,
  };
}

angular.module('grafana.directives').directive('dashnav', dashNavDirective);
