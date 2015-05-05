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
        controller: 'DashLinkEditorCtrl',
        templateUrl: 'app/features/dashlinks/editor.html',
        link: function() {
        }
      };
    }).directive('dashLink', function(linkSrv) {
      return {
        scope: {
          link: "="
        },
        restrict: 'E',
        controller: 'DashLinkCtrl',
        templateUrl: 'app/features/dashlinks/module.html',
        link: function(scope, elem) {

          function update() {
            var linkInfo = linkSrv.getPanelLinkAnchorInfo(scope.link);
            elem.find("span").text(linkInfo.title);
            elem.find("a").attr("href", linkInfo.href);
          }

          update();
          scope.$on('refresh', update);
        }
      };
    })
    .controller("DashLinkCtrl", function($scope) {

    })
    .controller('DashLinkEditorCtrl', function($scope, backendSrv) {

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
