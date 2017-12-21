import angular from 'angular';
import _ from 'lodash';
import './link_srv';

function panelLinksEditor() {
  return {
    scope: {
      panel: '=',
    },
    restrict: 'E',
    controller: 'PanelLinksEditorCtrl',
    templateUrl: 'public/app/features/panellinks/module.html',
    link: function() {},
  };
}

export class PanelLinksEditorCtrl {
  /** @ngInject */
  constructor($scope, backendSrv) {
    $scope.panel.links = $scope.panel.links || [];

    $scope.addLink = function() {
      $scope.panel.links.push({
        type: 'dashboard',
      });
    };

    $scope.searchDashboards = function(queryStr, callback) {
      backendSrv.search({ query: queryStr }).then(function(hits) {
        var dashboards = _.map(hits, function(dash) {
          return dash.title;
        });

        callback(dashboards);
      });
    };

    $scope.dashboardChanged = function(link) {
      backendSrv.search({ query: link.dashboard }).then(function(hits) {
        var dashboard = _.find(hits, { title: link.dashboard });
        if (dashboard) {
          link.dashUri = dashboard.uri;
          link.title = dashboard.title;
        }
      });
    };

    $scope.deleteLink = function(link) {
      $scope.panel.links = _.without($scope.panel.links, link);
    };
  }
}

angular
  .module('grafana.directives')
  .directive('panelLinksEditor', panelLinksEditor)
  .controller('PanelLinksEditorCtrl', PanelLinksEditorCtrl);
