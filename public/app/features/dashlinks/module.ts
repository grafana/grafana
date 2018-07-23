import angular from 'angular';
import _ from 'lodash';
import { iconMap } from './editor';

function dashLinksContainer() {
  return {
    scope: {
      links: '=',
    },
    restrict: 'E',
    controller: 'DashLinksContainerCtrl',
    template: '<dash-link ng-repeat="link in generatedLinks" link="link"></dash-link>',
    link: function() {},
  };
}

/** @ngInject */
function dashLink($compile, $sanitize, linkSrv) {
  return {
    restrict: 'E',
    link: function(scope, elem) {
      var link = scope.link;
      var template =
        '<div class="gf-form">' +
        '<a class="pointer gf-form-label" data-placement="bottom"' +
        (link.asDropdown ? ' ng-click="fillDropdown(link)" data-toggle="dropdown"' : '') +
        '>' +
        '<i></i> <span></span></a>';

      if (link.asDropdown) {
        template +=
          '<ul class="dropdown-menu" role="menu">' +
          '<li ng-repeat="dash in link.searchHits">' +
          '<a href="{{dash.url}}" target="{{dash.target}}">{{dash.title}}</a>' +
          '</li>' +
          '</ul>';
      }

      template += '</div>';

      elem.html(template);
      $compile(elem.contents())(scope);

      function update() {
        var linkInfo = linkSrv.getAnchorInfo(link);

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
      scope.$on('refresh', update);
    },
  };
}

export class DashLinksContainerCtrl {
  /** @ngInject */
  constructor($scope, $rootScope, $q, backendSrv, dashboardSrv, linkSrv) {
    var currentDashId = dashboardSrv.getCurrent().id;

    function buildLinks(linkDef) {
      if (linkDef.type === 'dashboards') {
        if (!linkDef.tags) {
          console.log('Dashboard link missing tag');
          return $q.when([]);
        }

        if (linkDef.asDropdown) {
          return $q.when([
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
        return $q.when([
          {
            url: linkDef.url,
            title: linkDef.title,
            icon: iconMap[linkDef.icon],
            tooltip: linkDef.tooltip,
            target: linkDef.targetBlank ? '_blank' : '_self',
            keepTime: linkDef.keepTime,
            includeVars: linkDef.includeVars,
          },
        ]);
      }

      return $q.when([]);
    }

    function updateDashLinks() {
      var promises = _.map($scope.links, buildLinks);

      $q.all(promises).then(function(results) {
        $scope.generatedLinks = _.flatten(results);
      });
    }

    $scope.searchDashboards = function(link, limit) {
      return backendSrv.search({ tag: link.tags, limit: limit }).then(function(results) {
        return _.reduce(
          results,
          function(memo, dash) {
            // do not add current dashboard
            if (dash.id !== currentDashId) {
              memo.push({
                title: dash.title,
                url: 'dashboard/' + dash.uri,
                target: link.target,
                icon: 'fa fa-th-large',
                keepTime: link.keepTime,
                includeVars: link.includeVars,
              });
            }
            return memo;
          },
          []
        );
      });
    };

    $scope.fillDropdown = function(link) {
      $scope.searchDashboards(link, 100).then(function(results) {
        _.each(results, function(hit) {
          hit.url = linkSrv.getLinkUrl(hit);
        });
        link.searchHits = results;
      });
    };

    updateDashLinks();
    $rootScope.onAppEvent('dash-links-updated', updateDashLinks, $scope);
  }
}

angular.module('grafana.directives').directive('dashLinksContainer', dashLinksContainer);
angular.module('grafana.directives').directive('dashLink', dashLink);
angular.module('grafana.directives').controller('DashLinksContainerCtrl', DashLinksContainerCtrl);
