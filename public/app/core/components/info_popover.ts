///<reference path="../../headers/common.d.ts" />

import _ from 'lodash';
import $ from 'jquery';
import coreModule from 'app/core/core_module';
import Drop from 'tether-drop';

export function infoPopover() {
  return {
    restrict: 'E',
    transclude: true,
    link: function(scope, elem, attrs, ctrl, transclude) {
      var inputElem = elem.prev();
      if (inputElem.length === 0) {
        console.log('Failed to find input element for popover');
        return;
      }

      var offset = attrs.offset || '0 -10px';
      var position = attrs.position || 'right middle';
      var classes = 'drop-help drop-hide-out-of-bounds';
      if (attrs.wide) {
        classes += ' drop-wide';
      }

      transclude(function(clone, newScope) {
        var content = document.createElement("div");
        _.each(clone, (node) => {
          content.appendChild(node);
        });

        var drop = new Drop({
          target: inputElem[0],
          content: content,
          position: position,
          classes: classes,
          openOn: 'click',
          tetherOptions: {
            offset: offset
          }
        });

        scope.$on('$destroy', function() {
          drop.destroy();
        });

      });
    }
  };
}

coreModule.directive('infoPopover', infoPopover);
