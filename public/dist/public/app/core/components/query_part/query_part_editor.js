import { debounce, each, map, partial, escape, unescape } from 'lodash';
import $ from 'jquery';
import coreModule from 'app/core/core_module';
import { promiseToDigest } from '../../utils/promiseToDigest';
var template = "\n<div class=\"dropdown cascade-open\">\n<a ng-click=\"showActionsMenu()\" class=\"query-part-name pointer dropdown-toggle\" data-toggle=\"dropdown\">{{part.def.type}}</a>\n<span>(</span><span class=\"query-part-parameters\"></span><span>)</span>\n<ul class=\"dropdown-menu\">\n  <li ng-repeat=\"action in partActions\">\n    <a ng-click=\"triggerPartAction(action)\">{{action.text}}</a>\n  </li>\n</ul>\n";
/** @ngInject */
export function queryPartEditorDirective(templateSrv) {
    var paramTemplate = '<input type="text" class="hide input-mini tight-form-func-param"></input>';
    return {
        restrict: 'E',
        template: template,
        scope: {
            part: '=',
            handleEvent: '&',
            debounce: '@',
        },
        link: function postLink($scope, elem) {
            var part = $scope.part;
            var partDef = part.def;
            var $paramsContainer = elem.find('.query-part-parameters');
            var debounceLookup = $scope.debounce;
            $scope.partActions = [];
            function clickFuncParam(paramIndex) {
                var $link = $(this);
                var $input = $link.next();
                $input.val(part.params[paramIndex]);
                $input.css('width', $link.width() + 16 + 'px');
                $link.hide();
                $input.show();
                $input.focus();
                $input.select();
                var typeahead = $input.data('typeahead');
                if (typeahead) {
                    $input.val('');
                    typeahead.lookup();
                }
            }
            function inputBlur(paramIndex) {
                var $input = $(this);
                var $link = $input.prev();
                var newValue = $input.val();
                if (newValue !== '' || part.def.params[paramIndex].optional) {
                    $link.html(templateSrv.highlightVariablesAsHtml(newValue));
                    part.updateParam($input.val(), paramIndex);
                    $scope.$apply(function () {
                        $scope.handleEvent({ $event: { name: 'part-param-changed' } });
                    });
                }
                $input.hide();
                $link.show();
            }
            function inputKeyPress(paramIndex, e) {
                if (e.which === 13) {
                    inputBlur.call(this, paramIndex);
                }
            }
            function inputKeyDown() {
                this.style.width = (3 + this.value.length) * 8 + 'px';
            }
            function addTypeahead($input, param, paramIndex) {
                if (!param.options && !param.dynamicLookup) {
                    return;
                }
                var typeaheadSource = function (query, callback) {
                    if (param.options) {
                        var options = param.options;
                        if (param.type === 'int') {
                            options = map(options, function (val) {
                                return val.toString();
                            });
                        }
                        return options;
                    }
                    $scope.$apply(function () {
                        $scope.handleEvent({ $event: { name: 'get-param-options' } }).then(function (result) {
                            var dynamicOptions = map(result, function (op) {
                                return escape(op.value);
                            });
                            callback(dynamicOptions);
                        });
                    });
                };
                $input.attr('data-provide', 'typeahead');
                $input.typeahead({
                    source: typeaheadSource,
                    minLength: 0,
                    items: 1000,
                    updater: function (value) {
                        value = unescape(value);
                        setTimeout(function () {
                            inputBlur.call($input[0], paramIndex);
                        }, 0);
                        return value;
                    },
                });
                var typeahead = $input.data('typeahead');
                typeahead.lookup = function () {
                    this.query = this.$element.val() || '';
                    var items = this.source(this.query, $.proxy(this.process, this));
                    return items ? this.process(items) : items;
                };
                if (debounceLookup) {
                    typeahead.lookup = debounce(typeahead.lookup, 500, { leading: true });
                }
            }
            $scope.showActionsMenu = function () {
                promiseToDigest($scope)($scope.handleEvent({ $event: { name: 'get-part-actions' } }).then(function (res) {
                    $scope.partActions = res;
                }));
            };
            $scope.triggerPartAction = function (action) {
                $scope.handleEvent({ $event: { name: 'action', action: action } });
            };
            function addElementsAndCompile() {
                each(partDef.params, function (param, index) {
                    if (param.optional && part.params.length <= index) {
                        return;
                    }
                    if (index > 0) {
                        $('<span>, </span>').appendTo($paramsContainer);
                    }
                    var paramValue = templateSrv.highlightVariablesAsHtml(part.params[index]);
                    var $paramLink = $('<a class="graphite-func-param-link pointer">' + paramValue + '</a>');
                    var $input = $(paramTemplate);
                    $paramLink.appendTo($paramsContainer);
                    $input.appendTo($paramsContainer);
                    $input.blur(partial(inputBlur, index));
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
coreModule.directive('queryPartEditor', queryPartEditorDirective);
//# sourceMappingURL=query_part_editor.js.map