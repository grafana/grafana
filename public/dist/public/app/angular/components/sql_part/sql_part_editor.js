import $ from 'jquery';
import { debounce, each, indexOf, map, partial, escape, unescape } from 'lodash';
import coreModule from 'app/angular/core_module';
const template = `
<div class="dropdown cascade-open">
<a ng-click="showActionsMenu()" class="query-part-name pointer dropdown-toggle" data-toggle="dropdown">{{part.label}}</a>
<span>{{part.def.wrapOpen}}</span><span class="query-part-parameters"></span><span>{{part.def.wrapClose}}</span>
<ul class="dropdown-menu">
  <li ng-repeat="action in partActions">
    <a ng-click="triggerPartAction(action)">{{action.text}}</a>
  </li>
</ul>
`;
coreModule.directive('sqlPartEditor', ['templateSrv', sqlPartEditorDirective]);
export function sqlPartEditorDirective(templateSrv) {
    const paramTemplate = '<input type="text" class="hide input-mini"></input>';
    return {
        restrict: 'E',
        template: template,
        scope: {
            part: '=',
            handleEvent: '&',
            debounce: '@',
        },
        link: function postLink($scope, elem) {
            const part = $scope.part;
            const partDef = part.def;
            const $paramsContainer = elem.find('.query-part-parameters');
            const debounceLookup = $scope.debounce;
            let cancelBlur = null;
            $scope.partActions = [];
            function clickFuncParam(paramIndex) {
                const $link = $(this);
                const $input = $link.next();
                $input.val(part.params[paramIndex]);
                $input.css('width', $link.width() + 16 + 'px');
                $link.hide();
                $input.show();
                $input.focus();
                $input.select();
                const typeahead = $input.data('typeahead');
                if (typeahead) {
                    $input.val('');
                    typeahead.lookup();
                }
            }
            function inputBlur($input, paramIndex) {
                cancelBlur = setTimeout(() => {
                    switchToLink($input, paramIndex);
                }, 200);
            }
            function switchToLink($input, paramIndex) {
                const $link = $input.prev();
                const newValue = $input.val();
                if (newValue !== '' || part.def.params[paramIndex].optional) {
                    $link.html(templateSrv.highlightVariablesAsHtml(newValue));
                    part.updateParam($input.val(), paramIndex);
                    $scope.$apply(() => {
                        $scope.handleEvent({ $event: { name: 'part-param-changed' } });
                    });
                }
                $input.hide();
                $link.show();
            }
            function inputKeyPress(paramIndex, e) {
                if (e.which === 13) {
                    switchToLink($(this), paramIndex);
                }
            }
            function inputKeyDown() {
                this.style.width = (3 + this.value.length) * 8 + 'px';
            }
            function addTypeahead($input, param, paramIndex) {
                if (!param.options && !param.dynamicLookup) {
                    return;
                }
                const typeaheadSource = (query, callback) => {
                    if (param.options) {
                        let options = param.options;
                        if (param.type === 'int') {
                            options = map(options, (val) => {
                                return val.toString();
                            });
                        }
                        return options;
                    }
                    $scope.$apply(() => {
                        $scope.handleEvent({ $event: { name: 'get-param-options', param: param } }).then((result) => {
                            const dynamicOptions = map(result, (op) => {
                                return escape(op.value);
                            });
                            // add current value to dropdown if it's not in dynamicOptions
                            if (indexOf(dynamicOptions, part.params[paramIndex]) === -1) {
                                dynamicOptions.unshift(escape(part.params[paramIndex]));
                            }
                            callback(dynamicOptions);
                        });
                    });
                };
                $input.attr('data-provide', 'typeahead');
                $input.typeahead({
                    source: typeaheadSource,
                    minLength: 0,
                    items: 1000,
                    updater: (value) => {
                        value = unescape(value);
                        if (value === part.params[paramIndex]) {
                            clearTimeout(cancelBlur);
                            $input.focus();
                            return value;
                        }
                        return value;
                    },
                });
                const typeahead = $input.data('typeahead');
                typeahead.lookup = function () {
                    this.query = this.$element.val() || '';
                    const items = this.source(this.query, $.proxy(this.process, this));
                    return items ? this.process(items) : items;
                };
                if (debounceLookup) {
                    typeahead.lookup = debounce(typeahead.lookup, 500, { leading: true });
                }
            }
            $scope.showActionsMenu = () => {
                $scope.handleEvent({ $event: { name: 'get-part-actions' } }).then((res) => {
                    $scope.partActions = res;
                });
            };
            $scope.triggerPartAction = (action) => {
                $scope.handleEvent({ $event: { name: 'action', action: action } });
            };
            function addElementsAndCompile() {
                each(partDef.params, (param, index) => {
                    if (param.optional && part.params.length <= index) {
                        return;
                    }
                    if (index > 0) {
                        $('<span>' + partDef.separator + '</span>').appendTo($paramsContainer);
                    }
                    const paramValue = templateSrv.highlightVariablesAsHtml(part.params[index]);
                    const $paramLink = $('<a class="query-part__link">' + paramValue + '</a>');
                    const $input = $(paramTemplate);
                    $paramLink.appendTo($paramsContainer);
                    $input.appendTo($paramsContainer);
                    $input.blur(partial(inputBlur, $input, index));
                    $input.keyup(inputKeyDown);
                    $input.keypress(partial(inputKeyPress, index));
                    $paramLink.click(partial(clickFuncParam, index));
                    addTypeahead($input, param, index);
                });
            }
            function relink() {
                $paramsContainer.empty();
                addElementsAndCompile();
            }
            relink();
        },
    };
}
//# sourceMappingURL=sql_part_editor.js.map