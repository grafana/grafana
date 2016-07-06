///<reference path="../../../headers/common.d.ts" />

import _ from 'lodash';
import moment from 'moment';
import angular from 'angular';

import {DashboardExporter} from '../export/exporter';

export class DashNavCtrl {

  /** @ngInject */
  constructor($scope, $rootScope, alertSrv, $location, playlistSrv, backendSrv, $timeout, datasourceSrv) {

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

      var clone = $scope.dashboard.getSaveModelClone();

      backendSrv.saveDashboard(clone, {overwrite: false}).then(function(data) {
        $scope.dashboard.version = data.version;
        $scope.appEvent('dashboard-saved', $scope.dashboard);
        $scope.appEvent('alert-success', ['Dashboard saved', 'Saved as ' + clone.title]);

        // force refresh whole page
        window.location.href = window.location.href;
      }, $scope.handleSaveDashError);
    };

    $scope.saveDashboard = function(options) {
      if ($scope.dashboardMeta.canSave === false) {
        return;
      }

      var clone = $scope.dashboard.getSaveModelClone();

      backendSrv.saveDashboard(clone, options).then(function(data) {
        $scope.dashboard.version = data.version;
        $scope.appEvent('dashboard-saved', $scope.dashboard);

        var dashboardUrl = '/dashboard/db/' + data.slug;

        if (dashboardUrl !== $location.path()) {
          $location.url(dashboardUrl);
        }

        $scope.appEvent('alert-success', ['Dashboard saved', 'Saved as ' + clone.title]);
      }, $scope.handleSaveDashError);
    };

    $scope.handleSaveDashError = function(err) {
      if (err.data && err.data.status === "version-mismatch") {
        err.isHandled = true;

        $scope.appEvent('confirm-modal', {
          title: 'Conflict',
          text: 'Someone else has updated this dashboard.',
          text2: 'Would you still like to save this dashboard?',
          yesText: "Save & Overwrite",
          icon: "fa-warning",
          onConfirm: function() {
            $scope.saveDashboard({overwrite: true});
          }
        });
      }

      if (err.data && err.data.status === "name-exists") {
        err.isHandled = true;

        $scope.appEvent('confirm-modal', {
          title: 'Conflict',
          text: 'Dashboard with the same name exists.',
          text2: 'Would you still like to save this dashboard?',
          yesText: "Save & Overwrite",
          icon: "fa-warning",
          onConfirm: function() {
            $scope.saveDashboard({overwrite: true});
          }
        });
      }
    };

    $scope.deleteDashboard = function() {
      $scope.appEvent('confirm-modal', {
        title: 'Delete',
        text: 'Do you want to delete this dashboard?',
        text2: $scope.dashboard.title,
        icon: 'fa-trash',
        yesText: 'Delete',
        onConfirm: function() {
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
      var newScope = $rootScope.$new();
      newScope.clone = $scope.dashboard.getSaveModelClone();
      newScope.clone.editable = true;
      newScope.clone.hideControls = false;

      $scope.appEvent('show-modal', {
        src: 'public/app/features/dashboard/partials/saveDashboardAs.html',
        scope: newScope,
        modalClass: 'modal--narrow'
      });
    };

    $scope.viewJson = function() {
      var clone = $scope.dashboard.getSaveModelClone();
      var html = angular.toJson(clone, true);
      var uri = "data:application/json," + encodeURIComponent(html);
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
