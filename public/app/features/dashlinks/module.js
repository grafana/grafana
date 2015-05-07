define([
  'angular',
  'lodash',
],
function (angular, _) {
  'use strict';

  var module = angular.module('grafana.directives');

  var iconMap = {
    "external link": "fa-external-link",
    "dashboard": "fa-th-large",
    "question": "fa-question",
    "info": "fa-info",
    "bolt": "fa-bolt",
    "doc": "fa-file-text-o",
    "cloud": "fa-cloud",
  };

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
        icon.attr('class', 'fa fa-fw ' + scope.link.icon);

        update();
        scope.$on('refresh', update);
      }
    };
  });

  module.controller("DashLinksContainerCtrl", function($scope, $rootScope, $q, backendSrv, dashboardSrv) {
    var currentDashId = dashboardSrv.getCurrent().id;

    function buildLinks(linkDef) {
      if (linkDef.type === 'dashboards') {
        if (!linkDef.tag) {
          console.log('Dashboard link missing tag');
          return $q.when([]);
        }

        return backendSrv.search({tag: linkDef.tag}).then(function(results) {
          return _.reduce(results.dashboards, function(memo, dash) {
            // do not add current dashboard
            if (dash.id !== currentDashId) {
              memo.push({ title: dash.title, url: 'dashboard/db/'+ dash.slug, icon: 'fa fa-th-large' });
            }
            return memo;
          }, []);
        });
      }

      if (linkDef.type === 'link') {
        return $q.when([{
          url: linkDef.url,
          title: linkDef.title,
          icon: iconMap[linkDef.icon]
        }]);
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

  module.controller('DashLinkEditorCtrl', function($scope, $rootScope) {

    $scope.iconMap = iconMap;
    $scope.dashboard.links = $scope.dashboard.links || [];
    $scope.addLink = function() {
      $scope.dashboard.links.push({ type: 'dashboards', icon: 'external link' });
    };

    $scope.moveLink = function(index, dir) {
      _.move($scope.dashboard.links, index, index+dir);
      $scope.updated();
    };

    $scope.updated = function() {
      $rootScope.appEvent('dash-links-updated');
    };

    $scope.deleteLink = function(link) {
      $scope.dashboard.links = _.without($scope.dashboard.links, link);
    };

  });
});
