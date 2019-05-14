import _ from 'lodash';
import $ from 'jquery';
import coreModule from 'app/core/core_module';
/** @ngInject */
export function graphiteFuncEditor($compile, templateSrv, popoverSrv) {
    var funcSpanTemplate = "\n    <function-editor\n      func=\"func\"\n      onRemove=\"ctrl.handleRemoveFunction\"\n      onMoveLeft=\"ctrl.handleMoveLeft\"\n      onMoveRight=\"ctrl.handleMoveRight\"\n    /><span>(</span>\n  ";
    var paramTemplate = '<input type="text" style="display:none"' + ' class="input-small tight-form-func-param"></input>';
    return {
        restrict: 'A',
        link: function postLink($scope, elem) {
            var $funcLink = $(funcSpanTemplate);
            var ctrl = $scope.ctrl;
            var func = $scope.func;
            var scheduledRelink = false;
            var paramCountAtLink = 0;
            var cancelBlur = null;
            ctrl.handleRemoveFunction = function (func) {
                ctrl.removeFunction(func);
            };
            ctrl.handleMoveLeft = function (func) {
                ctrl.moveFunction(func, -1);
            };
            ctrl.handleMoveRight = function (func) {
                ctrl.moveFunction(func, 1);
            };
            function clickFuncParam(paramIndex) {
                /*jshint validthis:true */
                var $link = $(this);
                var $comma = $link.prev('.comma');
                var $input = $link.next();
                $input.val(func.params[paramIndex]);
                $comma.removeClass('query-part__last');
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
            function scheduledRelinkIfNeeded() {
                if (paramCountAtLink === func.params.length) {
                    return;
                }
                if (!scheduledRelink) {
                    scheduledRelink = true;
                    setTimeout(function () {
                        relink();
                        scheduledRelink = false;
                    }, 200);
                }
            }
            function paramDef(index) {
                if (index < func.def.params.length) {
                    return func.def.params[index];
                }
                if (_.last(func.def.params).multiple) {
                    return _.assign({}, _.last(func.def.params), { optional: true });
                }
                return {};
            }
            function switchToLink(inputElem, paramIndex) {
                /*jshint validthis:true */
                var $input = $(inputElem);
                clearTimeout(cancelBlur);
                cancelBlur = null;
                var $link = $input.prev();
                var $comma = $link.prev('.comma');
                var newValue = $input.val();
                // remove optional empty params
                if (newValue !== '' || paramDef(paramIndex).optional) {
                    func.updateParam(newValue, paramIndex);
                    $link.html(newValue ? templateSrv.highlightVariablesAsHtml(newValue) : '&nbsp;');
                }
                scheduledRelinkIfNeeded();
                $scope.$apply(function () {
                    ctrl.targetChanged();
                });
                if ($link.hasClass('query-part__last') && newValue === '') {
                    $comma.addClass('query-part__last');
                }
                else {
                    $link.removeClass('query-part__last');
                }
                $input.hide();
                $link.show();
            }
            // this = input element
            function inputBlur(paramIndex) {
                /*jshint validthis:true */
                var inputElem = this;
                // happens long before the click event on the typeahead options
                // need to have long delay because the blur
                cancelBlur = setTimeout(function () {
                    switchToLink(inputElem, paramIndex);
                }, 200);
            }
            function inputKeyPress(paramIndex, e) {
                /*jshint validthis:true */
                if (e.which === 13) {
                    $(this).blur();
                }
            }
            function inputKeyDown() {
                /*jshint validthis:true */
                this.style.width = (3 + this.value.length) * 8 + 'px';
            }
            function addTypeahead($input, paramIndex) {
                $input.attr('data-provide', 'typeahead');
                var options = paramDef(paramIndex).options;
                if (paramDef(paramIndex).type === 'int') {
                    options = _.map(options, function (val) {
                        return val.toString();
                    });
                }
                $input.typeahead({
                    source: options,
                    minLength: 0,
                    items: 20,
                    updater: function (value) {
                        $input.val(value);
                        switchToLink($input[0], paramIndex);
                        return value;
                    },
                });
                var typeahead = $input.data('typeahead');
                typeahead.lookup = function () {
                    this.query = this.$element.val() || '';
                    return this.process(this.source);
                };
            }
            function addElementsAndCompile() {
                $funcLink.appendTo(elem);
                var defParams = _.clone(func.def.params);
                var lastParam = _.last(func.def.params);
                while (func.params.length >= defParams.length && lastParam && lastParam.multiple) {
                    defParams.push(_.assign({}, lastParam, { optional: true }));
                }
                _.each(defParams, function (param, index) {
                    if (param.optional && func.params.length < index) {
                        return false;
                    }
                    var paramValue = templateSrv.highlightVariablesAsHtml(func.params[index]);
                    var last = index >= func.params.length - 1 && param.optional && !paramValue;
                    if (last && param.multiple) {
                        paramValue = '+';
                    }
                    if (index > 0) {
                        $('<span class="comma' + (last ? ' query-part__last' : '') + '">, </span>').appendTo(elem);
                    }
                    var $paramLink = $('<a ng-click="" class="graphite-func-param-link' +
                        (last ? ' query-part__last' : '') +
                        '">' +
                        (paramValue || '&nbsp;') +
                        '</a>');
                    var $input = $(paramTemplate);
                    $input.attr('placeholder', param.name);
                    paramCountAtLink++;
                    $paramLink.appendTo(elem);
                    $input.appendTo(elem);
                    $input.blur(_.partial(inputBlur, index));
                    $input.keyup(inputKeyDown);
                    $input.keypress(_.partial(inputKeyPress, index));
                    $paramLink.click(_.partial(clickFuncParam, index));
                    if (param.options) {
                        addTypeahead($input, index);
                    }
                    return true;
                });
                $('<span>)</span>').appendTo(elem);
                $compile(elem.contents())($scope);
            }
            function ifJustAddedFocusFirstParam() {
                if ($scope.func.added) {
                    $scope.func.added = false;
                    setTimeout(function () {
                        elem
                            .find('.graphite-func-param-link')
                            .first()
                            .click();
                    }, 10);
                }
            }
            function relink() {
                elem.children().remove();
                addElementsAndCompile();
                ifJustAddedFocusFirstParam();
            }
            relink();
        },
    };
}
coreModule.directive('graphiteFuncEditor', graphiteFuncEditor);
//# sourceMappingURL=func_editor.js.map