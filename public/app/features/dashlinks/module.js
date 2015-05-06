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
    }).directive('dashLink', function(linkSrv, $rootScope) {
      return {
        scope: {
          link: "="
        },
        restrict: 'E',
        controller: 'DashLinkCtrl',
        templateUrl: 'app/features/dashlinks/module.html',
        link: function(scope, elem) {
          var linkInfo;
          var anchor = elem.find('a');
          var icon = elem.find('i');
          var span = elem.find('span');

          function update() {
            linkInfo = linkSrv.getPanelLinkAnchorInfo(scope.link);
            span.text(linkInfo.title);
            anchor.attr("href", linkInfo.href);

            if (scope.link.type === 'absolute') {
              icon.attr('class', 'fa fw fa-external-link');
              anchor.attr('target', '_blank');
            } else {
              icon.attr('class', 'fa fw fa-th-large');
              anchor.attr('target', '');
            }
          }

          // tooltip
          elem.find('a').tooltip({
            title: function () {
              if (scope.link.tooltip) {
                return scope.link.tooltip;
              }
              else if (scope.link.type === 'dashboard') {
                return 'Open dashboard';
              } else if (scope.link.type === 'absolute') {
                return 'Open external page';
              }
            },
            html: true,
            container: 'body', // Grafana change
          });

          update();
          scope.$on('refresh', update);
          $rootScope.onAppEvent('dash-links-updated', update);
        }
      };
    })
    .controller("DashLinkCtrl", function() {
    })
    .controller('DashLinkEditorCtrl', function($scope, backendSrv, $rootScope) {

      $scope.dashboard.links = $scope.dashboard.links || [];
      $scope.addLink = function() {
        $scope.dashboard.links.push({
          type: 'dashboard',
          name: 'Related dashboard'
        });
      };

      $scope.updated = function() {
        $rootScope.appEvent('dash-links-updated');
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
