///<reference path="../../headers/common.d.ts" />

import config from 'app/core/config';
import _ from 'lodash';
import $ from 'jquery';
import coreModule from 'app/core/core_module';

/** @ngInject **/
function popoverSrv($templateCache, $timeout, $q, $http, $compile) {

  this.getTemplate = function(url) {
    return $q.when($templateCache.get(url) || $http.get(url, {cache: true}));
  };

  this.show = function(options) {

    options.scope.dismiss = function() {
      var popover = options.element.data('popover');
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

        var popover = options.element.data('popover');
        popover.hasContent = function () {
          return template;
        };

        popover.toggle();
        popover.scope = options.scope;
        $compile(popover.$tip)(popover.scope);
      }, 1);
    });
  };
}

coreModule.service('popoverSrv', popoverSrv);
