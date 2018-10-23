import _ from 'lodash';
import $ from 'jquery';
import rst2html from 'rst2html';
import coreModule from 'app/core/core_module';

/** @ngInject */
export function graphiteFuncEditor($compile, templateSrv, popoverSrv) {
  const funcSpanTemplate = '<a ng-click="">{{func.def.name}}</a><span>(</span>';
  const paramTemplate =
    '<input type="text" style="display:none"' + ' class="input-small tight-form-func-param"></input>';

  const funcControlsTemplate = `
    <div class="tight-form-func-controls">
      <span class="pointer fa fa-arrow-left"></span>
      <span class="pointer fa fa-question-circle"></span>
      <span class="pointer fa fa-remove" ></span>
      <span class="pointer fa fa-arrow-right"></span>
    </div>`;

  return {
    restrict: 'A',
    link: function postLink($scope, elem) {
      const $funcLink = $(funcSpanTemplate);
      const $funcControls = $(funcControlsTemplate);
      const ctrl = $scope.ctrl;
      const func = $scope.func;
      let scheduledRelink = false;
      let paramCountAtLink = 0;
      let cancelBlur = null;

      function clickFuncParam(this: any, paramIndex) {
        /*jshint validthis:true */

        const $link = $(this);
        const $comma = $link.prev('.comma');
        const $input = $link.next();

        $input.val(func.params[paramIndex]);

        $comma.removeClass('query-part__last');
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

      function scheduledRelinkIfNeeded() {
        if (paramCountAtLink === func.params.length) {
          return;
        }

        if (!scheduledRelink) {
          scheduledRelink = true;
          setTimeout(() => {
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
        const $input = $(inputElem);

        clearTimeout(cancelBlur);
        cancelBlur = null;

        const $link = $input.prev();
        const $comma = $link.prev('.comma');
        const newValue = $input.val();

        // remove optional empty params
        if (newValue !== '' || paramDef(paramIndex).optional) {
          func.updateParam(newValue, paramIndex);
          $link.html(newValue ? templateSrv.highlightVariablesAsHtml(newValue) : '&nbsp;');
        }

        scheduledRelinkIfNeeded();

        $scope.$apply(() => {
          ctrl.targetChanged();
        });

        if ($link.hasClass('query-part__last') && newValue === '') {
          $comma.addClass('query-part__last');
        } else {
          $link.removeClass('query-part__last');
        }

        $input.hide();
        $link.show();
      }

      // this = input element
      function inputBlur(this: any, paramIndex) {
        /*jshint validthis:true */
        const inputElem = this;
        // happens long before the click event on the typeahead options
        // need to have long delay because the blur
        cancelBlur = setTimeout(() => {
          switchToLink(inputElem, paramIndex);
        }, 200);
      }

      function inputKeyPress(this: any, paramIndex, e) {
        /*jshint validthis:true */
        if (e.which === 13) {
          $(this).blur();
        }
      }

      function inputKeyDown(this: any) {
        /*jshint validthis:true */
        this.style.width = (3 + this.value.length) * 8 + 'px';
      }

      function addTypeahead($input, paramIndex) {
        $input.attr('data-provide', 'typeahead');

        let options = paramDef(paramIndex).options;
        if (paramDef(paramIndex).type === 'int') {
          options = _.map(options, val => {
            return val.toString();
          });
        }

        $input.typeahead({
          source: options,
          minLength: 0,
          items: 20,
          updater: value => {
            $input.val(value);
            switchToLink($input[0], paramIndex);
            return value;
          },
        });

        const typeahead = $input.data('typeahead');
        typeahead.lookup = function() {
          this.query = this.$element.val() || '';
          return this.process(this.source);
        };
      }

      function toggleFuncControls() {
        const targetDiv = elem.closest('.tight-form');

        if (elem.hasClass('show-function-controls')) {
          elem.removeClass('show-function-controls');
          targetDiv.removeClass('has-open-function');
          $funcControls.hide();
          return;
        }

        elem.addClass('show-function-controls');
        targetDiv.addClass('has-open-function');

        $funcControls.show();
      }

      function addElementsAndCompile() {
        $funcControls.appendTo(elem);
        $funcLink.appendTo(elem);

        const defParams = _.clone(func.def.params);
        const lastParam = _.last(func.def.params);

        while (func.params.length >= defParams.length && lastParam && lastParam.multiple) {
          defParams.push(_.assign({}, lastParam, { optional: true }));
        }

        _.each(defParams, (param, index) => {
          if (param.optional && func.params.length < index) {
            return false;
          }

          let paramValue = templateSrv.highlightVariablesAsHtml(func.params[index]);

          const last = index >= func.params.length - 1 && param.optional && !paramValue;
          if (last && param.multiple) {
            paramValue = '+';
          }

          if (index > 0) {
            $('<span class="comma' + (last ? ' query-part__last' : '') + '">, </span>').appendTo(elem);
          }

          const $paramLink = $(
            '<a ng-click="" class="graphite-func-param-link' +
              (last ? ' query-part__last' : '') +
              '">' +
              (paramValue || '&nbsp;') +
              '</a>'
          );
          const $input = $(paramTemplate);
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
          setTimeout(() => {
            elem
              .find('.graphite-func-param-link')
              .first()
              .click();
          }, 10);
        }
      }

      function registerFuncControlsToggle() {
        $funcLink.click(toggleFuncControls);
      }

      function registerFuncControlsActions() {
        $funcControls.click(e => {
          const $target = $(e.target);
          if ($target.hasClass('fa-remove')) {
            toggleFuncControls();
            $scope.$apply(() => {
              ctrl.removeFunction($scope.func);
            });
            return;
          }

          if ($target.hasClass('fa-arrow-left')) {
            $scope.$apply(() => {
              _.move(ctrl.queryModel.functions, $scope.$index, $scope.$index - 1);
              ctrl.targetChanged();
            });
            return;
          }

          if ($target.hasClass('fa-arrow-right')) {
            $scope.$apply(() => {
              _.move(ctrl.queryModel.functions, $scope.$index, $scope.$index + 1);
              ctrl.targetChanged();
            });
            return;
          }

          if ($target.hasClass('fa-question-circle')) {
            const funcDef = ctrl.datasource.getFuncDef(func.def.name);
            if (funcDef && funcDef.description) {
              popoverSrv.show({
                element: e.target,
                position: 'bottom left',
                classNames: 'drop-popover drop-function-def',
                template: `
                  <div style="overflow:auto;max-height:30rem;">
                    <h4> ${funcDef.name} </h4>
                    ${rst2html(funcDef.description)}
                  </div>`,
                openOn: 'click',
              });
            } else {
              window.open(
                'http://graphite.readthedocs.org/en/latest/functions.html#graphite.render.functions.' + func.def.name,
                '_blank'
              );
            }
            return;
          }
        });
      }

      function relink() {
        elem.children().remove();

        addElementsAndCompile();
        ifJustAddedFocusFirstParam();
        registerFuncControlsToggle();
        registerFuncControlsActions();
      }

      relink();
    },
  };
}

coreModule.directive('graphiteFuncEditor', graphiteFuncEditor);
