define([
  'angular',
  'lodash',
],
function (angular, _) {
  'use strict';

  var module = angular.module('grafana.directives');

  module.directive('dashLinksEditor', function() {
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
  });

  module.directive('dashLinksContainer', function() {
    return {
      scope: {
        links: "="
      },
      restrict: 'E',
      controller: 'DashLinksContainerCtrl',
      template: '<dash-link ng-repeat="link in generatedLinks" link="link"></dash-link>',
      link: function() { }
    };
  });

  module.directive('dashLink', function(templateSrv) {
    return {
      scope: {
        link: "="
      },
      restrict: 'E',
      controller: 'DashLinkCtrl',
      templateUrl: 'app/features/dashlinks/module.html',
      link: function(scope, elem) {
        var anchor = elem.find('a');
        var icon = elem.find('i');
        var span = elem.find('span');

        function update() {
          span.text(templateSrv.replace(scope.link.title));
          anchor.attr("href", templateSrv.replace(scope.link.url));
        }

        // tooltip
        elem.find('a').tooltip({ title: scope.link.tooltip, html: true, container: 'body' });
        icon.attr('class', scope.link.icon);

        update();
        scope.$on('refresh', update);
      }
    };
  });

  module.controller("DashLinksContainerCtrl", function($scope, $rootScope, $q, backendSrv) {

    function buildLinks(linkDef) {
      if (linkDef.type === 'dashboards') {
        return backendSrv.search({tag: linkDef.tag}).then(function(results) {
          return _.map(results.dashboards, function(dash) {
            return {
              title: dash.title,
              url: 'dashboard/db/'+ dash.slug,
              icon: 'fa fa-th-large'
            };
          });
        });
      }

      if (linkDef.type === 'link') {
        return $q.when([{ url: linkDef.url, title: linkDef.title, icon: 'fa fa-external-link', }]);
      }

      return $q.when([]);
    }

    function updateDashLinks() {
      var promises = _.map($scope.links, buildLinks);

      $q.all(promises).then(function(results) {
        $scope.generatedLinks = _.flatten(results);
      });
    }

    updateDashLinks();
    $rootScope.onAppEvent('dash-links-updated', updateDashLinks);
  });

  module.controller("DashLinkCtrl", function($scope) {

    if ($scope.link.type === 'dashboards') {
      $scope.searchHits = [];
    }

  });

  module.controller('DashLinkEditorCtrl', function($scope, backendSrv, $rootScope) {

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
