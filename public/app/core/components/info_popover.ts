///<reference path="../../headers/common.d.ts" />

import _ from 'lodash';
import coreModule from 'app/core/core_module';
import Drop from 'tether-drop';

export function infoPopover() {
  return {
    restrict: 'E',
    template: '<i class="fa fa-info-circle"></i>',
    transclude: true,
    link: function(scope, elem, attrs, ctrl, transclude) {
      var offset = attrs.offset || '0 -10px';
      var position = attrs.position || 'right middle';
      var classes = 'drop-help drop-hide-out-of-bounds';
      var openOn = 'hover';

      elem.addClass('gf-form-help-icon');

      if (attrs.wide) {
        classes += ' drop-wide';
      }

      if (attrs.mode) {
        elem.addClass('gf-form-help-icon--' + attrs.mode);
      }

      transclude(function(clone, newScope) {
        var content = document.createElement('div');
        content.className = 'markdown-html';

        _.each(clone, node => {
          content.appendChild(node);
        });

        var drop = new Drop({
          target: elem[0],
          content: content,
          position: position,
          classes: classes,
          openOn: openOn,
          hoverOpenDelay: 400,
          tetherOptions: {
            offset: offset,
            constraints: [
              {
                to: 'window',
                attachment: 'together',
                pin: true,
              },
            ],
          },
        });

        var unbind = scope.$on('$destroy', function() {
          drop.destroy();
          unbind();
        });
      });
    },
  };
}

coreModule.directive('infoPopover', infoPopover);
