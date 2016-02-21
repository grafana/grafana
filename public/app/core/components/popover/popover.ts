///<reference path="../../../headers/common.d.ts" />

import _ from 'lodash';
import $ from 'jquery';
import coreModule from '../../core_module';
import Drop from 'tether-drop';

export function popoverDirective() {
  return {
    restrict: 'E',
    link: function(scope, elem, attrs) {
      var inputElem = elem.prev();
      console.log(inputElem);
      var drop = new Drop({
        target: inputElem[0],
        content: 'Welcome to the future!',
        position: 'right middle',
        classes: 'drop-theme-arrows-bounce-dark',
        openOn: 'click'
      });
    }
  };
}

coreModule.directive('gfPopover', popoverDirective);
