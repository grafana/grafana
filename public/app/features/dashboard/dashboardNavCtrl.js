define([
  'angular',
  'lodash',
  'config',
  'store',
  'filesaver'
],
function (angular, _) {
  'use strict';

  var module = angular.module('grafana.controllers');

  module.controller('DashboardNavCtrl', function($scope, $rootScope, alertSrv, $location, playlistSrv, backendSrv, $timeout) {

    $scope.init = function() {
      $scope.onAppEvent('save-dashboard', $scope.saveDashboard);
      $scope.onAppEvent('delete-dashboard', $scope.deleteDashboard);
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
      }
      else {
        backendSrv.post('/api/user/stars/dashboard/' + $scope.dashboard.id).then(function() {
          $scope.dashboardMeta.isStarred = true;
        });
      }
    };

    $scope.shareDashboard = function() {
      $scope.appEvent('show-modal', {
        src: './app/features/dashboard/partials/shareModal.html',
        scope: $scope.$new(),
      });
    };

    $scope.openSearch = function() {
      $scope.appEvent('show-dash-search');
    };

    $scope.dashboardTitleAction = function() {
      $scope.appEvent('hide-dash-editor');
      $scope.exitFullscreen();
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
          title: 'Someone else has updated this dashboard!',
          text: "Would you still like to save this dashboard?",
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
          title: 'Another dashboard with the same name exists',
          text: "Would you still like to save this dashboard?",
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
        title: 'Do you want to delete dashboard ' + $scope.dashboard.title + '?',
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
        src: './app/features/dashboard/partials/saveDashboardAs.html',
        scope: newScope,
      });
    };

    $scope.exportDashboard = function() {
      var clone = $scope.dashboard.getSaveModelClone();
      var blob = new Blob([angular.toJson(clone, true)], { type: "application/json;charset=utf-8" });
      window.saveAs(blob, $scope.dashboard.title + '-' + new Date().getTime());
    };

    $scope.snapshot = function() {
      $scope.dashboard.snapshot = true;
      $rootScope.$broadcast('refresh');

      $timeout(function() {
        $scope.exportDashboard();
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

  });

});
