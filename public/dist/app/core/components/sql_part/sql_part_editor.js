import _ from 'lodash';
import $ from 'jquery';
import coreModule from 'app/core/core_module';
var template = "\n<div class=\"dropdown cascade-open\">\n<a ng-click=\"showActionsMenu()\" class=\"query-part-name pointer dropdown-toggle\" data-toggle=\"dropdown\">{{part.label}}</a>\n<span>{{part.def.wrapOpen}}</span><span class=\"query-part-parameters\"></span><span>{{part.def.wrapClose}}</span>\n<ul class=\"dropdown-menu\">\n  <li ng-repeat=\"action in partActions\">\n    <a ng-click=\"triggerPartAction(action)\">{{action.text}}</a>\n  </li>\n</ul>\n";
/** @ngInject */
export function sqlPartEditorDirective($compile, templateSrv) {
    var paramTemplate = '<input type="text" class="hide input-mini"></input>';
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
            var cancelBlur = null;
            $scope.partActions = [];
            function clickFuncParam(paramIndex) {
                /*jshint validthis:true */
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
            function inputBlur($input, paramIndex) {
                cancelBlur = setTimeout(function () {
                    switchToLink($input, paramIndex);
                }, 200);
            }
            function switchToLink($input, paramIndex) {
                /*jshint validthis:true */
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
                /*jshint validthis:true */
                if (e.which === 13) {
                    switchToLink($(this), paramIndex);
                }
            }
            function inputKeyDown() {
                /*jshint validthis:true */
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
                            options = _.map(options, function (val) {
                                return val.toString();
                            });
                        }
                        return options;
                    }
                    $scope.$apply(function () {
                        $scope.handleEvent({ $event: { name: 'get-param-options', param: param } }).then(function (result) {
                            var dynamicOptions = _.map(result, function (op) {
                                return _.escape(op.value);
                            });
                            // add current value to dropdown if it's not in dynamicOptions
                            if (_.indexOf(dynamicOptions, part.params[paramIndex]) === -1) {
                                dynamicOptions.unshift(_.escape(part.params[paramIndex]));
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
                    updater: function (value) {
                        value = _.unescape(value);
                        if (value === part.params[paramIndex]) {
                            clearTimeout(cancelBlur);
                            $input.focus();
                            return value;
                        }
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
                    typeahead.lookup = _.debounce(typeahead.lookup, 500, { leading: true });
                }
            }
            $scope.showActionsMenu = function () {
                $scope.handleEvent({ $event: { name: 'get-part-actions' } }).then(function (res) {
                    $scope.partActions = res;
                });
            };
            $scope.triggerPartAction = function (action) {
                $scope.handleEvent({ $event: { name: 'action', action: action } });
            };
            function addElementsAndCompile() {
                _.each(partDef.params, function (param, index) {
                    if (param.optional && part.params.length <= index) {
                        return;
                    }
                    if (index > 0) {
                        $('<span>' + partDef.separator + '</span>').appendTo($paramsContainer);
                    }
                    var paramValue = templateSrv.highlightVariablesAsHtml(part.params[index]);
                    var $paramLink = $('<a class="graphite-func-param-link pointer">' + paramValue + '</a>');
                    var $input = $(paramTemplate);
                    $paramLink.appendTo($paramsContainer);
                    $input.appendTo($paramsContainer);
                    $input.blur(_.partial(inputBlur, $input, index));
                    $input.keyup(inputKeyDown);
                    $input.keypress(_.partial(inputKeyPress, index));
                    $paramLink.click(_.partial(clickFuncParam, index));
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
coreModule.directive('sqlPartEditor', sqlPartEditorDirective);
//# sourceMappingURL=sql_part_editor.js.map