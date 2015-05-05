define([
  'angular',
  'lodash',
],
function (angular, _) {
  'use strict';

  angular
    .module('grafana.directives')
    .directive('dashLinksEditor', function() {
      return {
        scope: {
          dashboard: "="
        },
        restrict: 'E',
        controller: 'DashLinkCtrl',
        templateUrl: 'app/features/dashlinks/editor.html',
        link: function() {
        }
      };
    }).directive('dashLinks', function() {
      return {
        scope: {
          dashboard: "="
        },
        restrict: 'E',
        controller: 'DashLinkCtrl',
        templateUrl: 'app/features/dashlinks/module.html',
        link: function() {
        }
      };
    }).controller('DashLinkCtrl', function($scope, backendSrv) {

      $scope.dashboard.links = $scope.dashboard.links || [];

      $scope.addLink = function() {
        $scope.dashboard.links.push({
          type: 'dashboard',
          name: 'Related dashboard'
        });
      };

      $scope.searchDashboards = function(queryStr, callback) {
        var query = {query: queryStr};

        backendSrv.search(query).then(function(result) {
          var dashboards = _.map(result.dashboards, function(dash) {
            return dash.title;
          });

          callback(dashboards);
        });
      };

      $scope.deleteLink = function(link) {
        $scope.dashboard.links = _.without($scope.dashboard.links, link);
      };

    });
});
