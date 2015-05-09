define([
  'angular',
  'lodash',
  './linkSrv',
],
function (angular, _) {
  'use strict';

  angular
    .module('grafana.directives')
    .directive('panelLinksEditor', function() {
      return {
        scope: {
          panel: "="
        },
        restrict: 'E',
        controller: 'PanelLinksEditorCtrl',
        templateUrl: 'app/features/panellinks/module.html',
        link: function() {
        }
      };
    }).controller('PanelLinksEditorCtrl', function($scope, backendSrv) {

      $scope.panel.links = $scope.panel.links || [];

      $scope.addLink = function() {
        $scope.panel.links.push({
          type: 'dashboard',
          name: 'Drilldown dashboard'
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
        $scope.panel.links = _.without($scope.panel.links, link);
      };

    });
});
