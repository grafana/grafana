define([
  'angular',
  'jquery',
  'lodash'
],
function (angular, $, _) {
  'use strict';

  angular
  .module('grafana.directives')
  .directive('annotationTooltip', function($sanitize, dashboardSrv, $compile) {
    return {
      link: function (scope, element) {
        var event = scope.event;
        var title = $sanitize(event.title);
        var dashboard = dashboardSrv.getCurrent();
        var time = '<i>' + dashboard.formatDate(event.min) + '</i>';

        var tooltip = '<div class="graph-tooltip small"><div class="graph-tooltip-time">' + title + ' ' + time + '</div> ' ;

        if (event.text) {
          var text = $sanitize(event.text);
          tooltip += text.replace(/\n/g, '<br>') + '<br>';
        }

        var tags = event.tags;
        if (_.isString(event.tags)) {
          tags = event.tags.split(',');
          if (tags.length === 1) {
            tags = event.tags.split(' ');
          }
        }

        if (tags && tags.length) {
          scope.tags = tags;
          tooltip += '<span class="label label-tag" ng-repeat="tag in tags" tag-color-from-name="tag">{{tag}}</span><br/>';
        }

        tooltip += "</div>";

        var $tooltip = $(tooltip);
        $tooltip.appendTo(element);

        $compile(element.contents())(scope);
      }
    };
  });

});
