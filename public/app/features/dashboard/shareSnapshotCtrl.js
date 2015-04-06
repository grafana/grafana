define([
  'angular',
  'lodash',
],
function (angular, _) {
  'use strict';

  var module = angular.module('grafana.controllers');

  module.controller('ShareSnapshotCtrl', function($scope, $rootScope, $location, backendSrv, $timeout, timeSrv) {

    $scope.snapshot = {
      name: $scope.dashboard.title,
      expires: 0,
    };

    $scope.step = 1;

    $scope.expireOptions = [
      {text: '1 Hour', value: 60*60},
      {text: '1 Day',  value: 60*60*24},
      {text: '7 Days', value: 60*60*7},
      {text: 'Never',  value: 0},
    ];

    $scope.accessOptions = [
      {text: 'Anyone with the link', value: 1},
      {text: 'Organization users',  value: 2},
      {text: 'Public on the web', value: 3},
    ];

    $scope.externalUrl = 'http://snapshots-origin.raintank.io';
    $scope.apiUrl = '/api/snapshots';

    $scope.createSnapshot = function(external) {
      $scope.dashboard.snapshot = {
        timestamp: new Date()
      };

      $scope.loading = true;
      $scope.snapshot.external = external;

      $rootScope.$broadcast('refresh');

      $timeout(function() {
        $scope.saveSnapshot(external);
      }, 4000);
    };

    $scope.saveSnapshot = function(external) {
      var dash = $scope.dashboard.getSaveModelClone();
      $scope.scrubDashboard(dash);

      var cmdData = {
        dashboard: dash,
        expires: $scope.snapshot.expires,
      };

      var postUrl = external ? $scope.externalUrl + $scope.apiUrl : $scope.apiUrl;

      backendSrv.post(postUrl, cmdData).then(function(results) {
        $scope.loading = false;

        if (external) {
          $scope.deleteUrl = results.deleteUrl;
          $scope.snapshotUrl = results.url;
          $scope.saveExternalSnapshotRef(cmdData, results);
        } else {
          var url = $location.url();
          var baseUrl = $location.absUrl();

          if (url !== '/') {
            baseUrl = baseUrl.replace(url, '') + '/';
          }

          $scope.snapshotUrl = baseUrl + 'dashboard/snapshot/' + results.key;
          $scope.deleteUrl = baseUrl + 'api/snapshots-delete/' + results.deleteKey;
        }

        $scope.step = 2;
      }, function() {
        $scope.loading = false;
      });
    };

    $scope.scrubDashboard = function(dash) {
      // change title
      dash.title = $scope.snapshot.name;
      // make relative times absolute
      dash.time = timeSrv.timeRange();
      // remove panel queries & links
      dash.forEachPanel(function(panel) {
        panel.targets = [];
        panel.links = [];
        panel.datasource = null;
      });
      // remove annotations
      dash.annotations.list = [];
      // remove template queries
      _.each(dash.templating.list, function(variable) {
        variable.query = "";
        variable.options = [];
        variable.refresh = false;
      });

      // snapshot single panel
      if ($scope.modeSharePanel) {
        var singlePanel = dash.getPanelById($scope.panel.id);
        singlePanel.span = 12;
        dash.rows = [{ height: '500px', span: 12, panels: [singlePanel] }];
      }

      // cleanup snapshotData
      delete $scope.dashboard.snapshot;
      $scope.dashboard.forEachPanel(function(panel) {
        delete panel.snapshotData;
      });
    };

    $scope.deleteSnapshot = function() {
      backendSrv.get($scope.deleteUrl).then(function() {
        $scope.step = 3;
      });
    };

    $scope.saveExternalSnapshotRef = function(cmdData, results) {
      // save external in local instance as well
      cmdData.external = true;
      cmdData.key = results.key;
      cmdData.deleteKey = results.deleteKey;
      backendSrv.post('/api/snapshots/', cmdData);
    };

  });

});
