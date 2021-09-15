import angular from 'angular';
import { map, find, without } from 'lodash';
import './link_srv';
import { backendSrv } from 'app/core/services/backend_srv';

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
  constructor($scope: any) {
    $scope.panel.links = $scope.panel.links || [];

    $scope.addLink = () => {
      $scope.panel.links.push({
        type: 'dashboard',
      });
    };

    $scope.searchDashboards = (queryStr: string, callback: Function) => {
      backendSrv.search({ query: queryStr }).then((hits) => {
        const dashboards = map(hits, (dash) => {
          return dash.title;
        });

        callback(dashboards);
      });
    };

    $scope.dashboardChanged = (link: any) => {
      backendSrv.search({ query: link.dashboard }).then((hits) => {
        const dashboard: any = find(hits, { title: link.dashboard });
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

    $scope.deleteLink = (link: any) => {
      $scope.panel.links = without($scope.panel.links, link);
    };
  }
}

angular
  .module('grafana.directives')
  .directive('panelLinksEditor', panelLinksEditor)
  .controller('PanelLinksEditorCtrl', PanelLinksEditorCtrl);
