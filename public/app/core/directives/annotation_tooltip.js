define([
  'jquery',
  'lodash',
  '../core_module',
],
function ($, _, coreModule) {
  'use strict';

  coreModule.default.directive('annotationTooltip', function($sanitize, dashboardSrv, $compile) {

    function sanitizeString(str) {
      try {
        return $sanitize(str);
      }
      catch(err) {
        console.log('Could not sanitize annotation string, html escaping instead');
        return _.escape(str);
      }
    }

    return {
      link: function (scope, element) {
        var event = scope.event;
        var title = sanitizeString(event.title);
        var dashboard = dashboardSrv.getCurrent();
        var time = '<i>' + dashboard.formatDate(event.min) + '</i>';

        var tooltip = '<div class="graph-tooltip small"><div class="graph-tooltip-time">' + title + ' ' + time + '</div> ' ;

        if (event.text) {
          var text = sanitizeString(event.text);
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
