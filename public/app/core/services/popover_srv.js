define([
  'angular',
  'lodash',
  'jquery',
  '../core_module',
],
function (angular, _, $, coreModule) {
  'use strict';

  coreModule.service('popoverSrv', function($templateCache, $timeout, $q, $http, $compile) {

    this.getTemplate = function(url) {
      return $q.when($templateCache.get(url) || $http.get(url, {cache: true}));
    };

    this.show = function(options) {
      var popover;

      // hide other popovers
      $('.popover').each(function() {
        popover = $(this).prev().data('popover');
        if (popover) {
          popover.scope.$destroy();
          popover.destroy();
        }
      });

      options.scope.dismiss = function() {
        popover = options.element.data('popover');
        if (popover) {
          popover.destroy();
        }
        options.scope.$destroy();
      };

      this.getTemplate(options.templateUrl).then(function(result) {
        $timeout(function() {
          var template = _.isString(result) ? result : result.data;

          options.element.popover({
            content: template,
            placement: options.placement || 'bottom',
            html: true
          });

          popover = options.element.data('popover');
          popover.hasContent = function () {
            return template;
          };

          popover.toggle();
          popover.scope = options.scope;
          $compile(popover.$tip)(popover.scope);
        }, 1);
      });
    };

  });

});
