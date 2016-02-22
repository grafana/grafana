///<reference path="../../headers/common.d.ts" />

import config from 'app/core/config';
import _ from 'lodash';
import $ from 'jquery';
import coreModule from 'app/core/core_module';
import Drop from 'tether-drop';

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

        var drop = new Drop({
          target: options.element[0],
          content: template,
          position: 'bottom top',
          classes: 'drop-help',
          openOn: 'click',
          tetherOptions: {
          }
        });

        drop.open();
        //$compile(popover.$tip)(popover.scope);
      }, 1);
    });
  };
}

coreModule.service('popoverSrv', popoverSrv);
