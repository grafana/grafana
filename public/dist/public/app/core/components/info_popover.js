import { each } from 'lodash';
import coreModule from 'app/core/core_module';
// @ts-ignore
import Drop from 'tether-drop';
export function infoPopover() {
    return {
        restrict: 'E',
        template: "<icon name=\"'info-circle'\" style=\"margin-left: 10px;\" size=\"'xs'\"></icon>",
        transclude: true,
        link: function (scope, elem, attrs, ctrl, transclude) {
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
            transclude(function (clone, newScope) {
                var content = document.createElement('div');
                content.className = 'markdown-html';
                each(clone, function (node) {
                    content.appendChild(node);
                });
                var dropOptions = {
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
                scope.$applyAsync(function () {
                    var drop = new Drop(dropOptions);
                    var unbind = scope.$on('$destroy', function () {
                        drop.destroy();
                        unbind();
                    });
                });
            });
        },
    };
}
coreModule.directive('infoPopover', infoPopover);
//# sourceMappingURL=info_popover.js.map