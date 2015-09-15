define([
  'jquery',
  'lodash',
  '../core_module',
],
function ($, _, coreModule) {
  'use strict';

<<<<<<< 6bdfa28aeaae9b1754a9ff9a568ec1dd5c7ad294:public/app/core/directives/annotation_tooltip.js
<<<<<<< ed375359a4037dfec094c6dd00ca5ef7c0324f48:public/app/core/directives/annotation_tooltip.js
  coreModule.directive('annotationTooltip', function($sanitize, dashboardSrv, $compile) {
=======
  angular
  .module('grafana.directives')
  .directive('annotationTooltip', function($sanitize, dashboardSrv, $compile) {
>>>>>>> fix(annotations): Fixed issue when html sanitizer failes for title to annotation body, now fallbacks to html escaping title and text, fixes #2563:public/app/directives/annotationTooltip.js
=======
  coreModule.directive('annotationTooltip', function($sanitize, dashboardSrv, $compile) {
>>>>>>> refactor: improving structure, moving things into a core module:public/app/core/directives/annotation_tooltip.js

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
