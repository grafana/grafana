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
    templateUrl: 'public/app/features/panel/panellinks/module.html',
    link: () => {},
  };
}

export class PanelLinksEditorCtrl {
  /** @ngInject */
  constructor($scope, backendSrv) {
    $scope.panel.links = $scope.panel.links || [];

    $scope.addLink = () => {
      $scope.panel.links.push({
        type: 'dashboard',
      });
    };

    $scope.searchDashboards = (queryStr, callback) => {
      backendSrv.search({ query: queryStr }).then(hits => {
        const dashboards = _.map(hits, dash => {
          return dash.title;
        });

        callback(dashboards);
      });
    };

    $scope.dashboardChanged = link => {
      backendSrv.search({ query: link.dashboard }).then(hits => {
        const dashboard: any = _.find(hits, { title: link.dashboard });
        if (dashboard) {
          if (dashboard.url) {
            link.url = dashboard.url;
          } else {
            // To support legacy url's
            link.dashUri = dashboard.uri;
          }
          link.title = dashboard.title;
        }
      });
    };

    $scope.deleteLink = link => {
      $scope.panel.links = _.without($scope.panel.links, link);
    };
  }
}

angular
  .module('grafana.directives')
  .directive('panelLinksEditor', panelLinksEditor)
  .controller('PanelLinksEditorCtrl', PanelLinksEditorCtrl);
