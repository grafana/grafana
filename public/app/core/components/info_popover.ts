import _ from 'lodash';
import coreModule from 'app/core/core_module';
import Drop from 'tether-drop';

export function infoPopover() {
  return {
    restrict: 'E',
    template: '<i class="fa fa-info-circle"></i>',
    transclude: true,
    link: function(scope, elem, attrs, ctrl, transclude) {
      let offset = attrs.offset || '0 -10px';
      let position = attrs.position || 'right middle';
      let classes = 'drop-help drop-hide-out-of-bounds';
      let openOn = 'hover';

      elem.addClass('gf-form-help-icon');

      if (attrs.wide) {
        classes += ' drop-wide';
      }

      if (attrs.mode) {
        elem.addClass('gf-form-help-icon--' + attrs.mode);
      }

      transclude(function(clone, newScope) {
        let content = document.createElement('div');
        content.className = 'markdown-html';

        _.each(clone, node => {
          content.appendChild(node);
        });

        let dropOptions = {
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
        };

        // Create drop in next digest after directive content is rendered.
        scope.$applyAsync(() => {
          let drop = new Drop(dropOptions);

          let unbind = scope.$on('$destroy', function() {
            drop.destroy();
            unbind();
          });
        });
      });
    },
  };
}

coreModule.directive('infoPopover', infoPopover);
