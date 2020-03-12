import angular from 'angular';
import _ from 'lodash';
import { iconMap } from './DashLinksEditorCtrl';
import { LinkSrv } from 'app/features/panel/panellinks/link_srv';
import { backendSrv } from 'app/core/services/backend_srv';
import { DashboardSrv } from '../../services/DashboardSrv';
import { PanelEvents } from '@grafana/data';
import { CoreEvents } from 'app/types';
import { GrafanaRootScope } from 'app/routes/GrafanaCtrl';
import { promiseToDigest } from '../../../../core/utils/promiseToDigest';

export type DashboardLink = { tags: any; target: string; keepTime: any; includeVars: any };

function dashLinksContainer() {
  return {
    scope: {
      links: '=',
      dashboard: '=',
    },
    restrict: 'E',
    controller: 'DashLinksContainerCtrl',
    template: '<dash-link ng-repeat="link in generatedLinks" link="link"></dash-link>',
    link: () => {},
  };
}

/** @ngInject */
function dashLink($compile: any, $sanitize: any, linkSrv: LinkSrv) {
  return {
    restrict: 'E',
    link: (scope: any, elem: JQuery) => {
      const link = scope.link;
      const dashboard = scope.dashboard;

      let template =
        '<div class="gf-form">' +
        '<a class="pointer gf-form-label" data-placement="bottom"' +
        (link.asDropdown ? ' ng-click="fillDropdown(link)" data-toggle="dropdown"' : '') +
        '>' +
        '<i></i> <span></span></a>';

      if (link.asDropdown) {
        template +=
          '<ul class="dropdown-menu pull-right" role="menu">' +
          '<li ng-repeat="dash in link.searchHits">' +
          '<a href="{{dash.url}}" target="{{dash.target}}">{{dash.title}}</a>' +
          '</li>' +
          '</ul>';
      }

      template += '</div>';

      elem.html(template);
      $compile(elem.contents())(scope);

      function update() {
        const linkInfo = linkSrv.getAnchorInfo(link);

        const anchor = elem.find('a');
        const span = elem.find('span');
        span.text(linkInfo.title);

        if (!link.asDropdown) {
          anchor.attr('href', linkInfo.href);
          sanitizeAnchor();
        }
        anchor.attr('data-placement', 'bottom');
        // tooltip
        anchor.tooltip({
          title: $sanitize(scope.link.tooltip),
          html: true,
          container: 'body',
        });
      }

      function sanitizeAnchor() {
        const anchor = elem.find('a');
        const anchorSanitized = $sanitize(anchor.parent().html());
        anchor.parent().html(anchorSanitized);
      }

      elem.find('i').attr('class', 'fa fa-fw ' + scope.link.icon);
      elem.find('a').attr('target', scope.link.target);

      // fix for menus on the far right
      if (link.asDropdown && scope.$last) {
        elem.find('.dropdown-menu').addClass('pull-right');
      }

      update();
      dashboard.events.on(PanelEvents.refresh, update, scope);
    },
  };
}

export class DashLinksContainerCtrl {
  /** @ngInject */
  constructor($scope: any, $rootScope: GrafanaRootScope, dashboardSrv: DashboardSrv, linkSrv: LinkSrv) {
    const currentDashId = dashboardSrv.getCurrent().id;

    function buildLinks(linkDef: any) {
      if (linkDef.type === 'dashboards') {
        if (!linkDef.tags) {
          console.log('Dashboard link missing tag');
          return Promise.resolve([]);
        }

        if (linkDef.asDropdown) {
          return Promise.resolve([
            {
              title: linkDef.title,
              tags: linkDef.tags,
              keepTime: linkDef.keepTime,
              includeVars: linkDef.includeVars,
              target: linkDef.targetBlank ? '_blank' : '_self',
              icon: 'fa fa-bars',
              asDropdown: true,
            },
          ]);
        }

        return $scope.searchDashboards(linkDef, 7);
      }

      if (linkDef.type === 'link') {
        return Promise.resolve([
          {
            url: linkDef.url,
            title: linkDef.title,
            // @ts-ignore
            icon: iconMap[linkDef.icon],
            tooltip: linkDef.tooltip,
            target: linkDef.targetBlank ? '_blank' : '_self',
            keepTime: linkDef.keepTime,
            includeVars: linkDef.includeVars,
          },
        ]);
      }

      return Promise.resolve([]);
    }

    function updateDashLinks() {
      const promises = _.map($scope.links, buildLinks);

      Promise.all(promises).then(results => {
        $scope.generatedLinks = _.flatten(results);
      });
    }

    $scope.searchDashboards = (link: DashboardLink, limit: any) => {
      return promiseToDigest($scope)(
        backendSrv.search({ tag: link.tags, limit: limit }).then(results => {
          return _.reduce(
            results,
            (memo, dash) => {
              // do not add current dashboard
              if (dash.id !== currentDashId) {
                memo.push({
                  title: dash.title,
                  url: dash.url,
                  target: link.target === '_self' ? '' : link.target,
                  icon: 'fa fa-th-large',
                  keepTime: link.keepTime,
                  includeVars: link.includeVars,
                });
              }
              return memo;
            },
            []
          );
        })
      );
    };

    $scope.fillDropdown = (link: { searchHits: any }) => {
      $scope.searchDashboards(link, 100).then((results: any) => {
        _.each(results, hit => {
          hit.url = linkSrv.getLinkUrl(hit);
        });
        link.searchHits = results;
      });
    };

    updateDashLinks();
    $rootScope.onAppEvent(CoreEvents.dashLinksUpdated, updateDashLinks, $scope);
  }
}

angular.module('grafana.directives').directive('dashLinksContainer', dashLinksContainer);
angular.module('grafana.directives').directive('dashLink', dashLink);
angular.module('grafana.directives').controller('DashLinksContainerCtrl', DashLinksContainerCtrl);
