define([
  'angular',
  'lodash',
  'jquery',
],
function (angular, _, $) {
  'use strict';

  angular
    .module('grafana.directives')
    .directive('graphiteFuncEditor', function($compile, templateSrv) {

      var funcSpanTemplate = '<a ng-click="">{{func.def.name}}</a><span>(</span>';
      var paramTemplate = '<input type="text" style="display:none"' +
                          ' class="input-mini tight-form-func-param"></input>';

      var funcControlsTemplate =
         '<div class="tight-form-func-controls">' +
           '<span class="pointer fa fa-arrow-left"></span>' +
           '<span class="pointer fa fa-question-circle"></span>' +
           '<span class="pointer fa fa-remove" ></span>' +
           '<span class="pointer fa fa-arrow-right"></span>' +
         '</div>';

      return {
        restrict: 'A',
        link: function postLink($scope, elem) {
          var $funcLink = $(funcSpanTemplate);
          var $funcControls = $(funcControlsTemplate);
          var func = $scope.func;
          var funcDef = func.def;
          var scheduledRelink = false;
          var paramCountAtLink = 0;

          function clickFuncParam(paramIndex) {
            /*jshint validthis:true */

            var $link = $(this);
            var $input = $link.next();

            $input.val(func.params[paramIndex]);
            $input.css('width', ($link.width() + 16) + 'px');

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
              setTimeout(function() {
                relink();
                scheduledRelink = false;
              }, 200);
            }
          }

          function inputBlur(paramIndex) {
            /*jshint validthis:true */
            var $input = $(this);
            var $link = $input.prev();
            var newValue = $input.val();

            if (newValue !== '' || func.def.params[paramIndex].optional) {
              $link.html(templateSrv.highlightVariablesAsHtml(newValue));

              func.updateParam($input.val(), paramIndex);
              scheduledRelinkIfNeeded();

              $scope.$apply($scope.targetChanged);
            }

            $input.hide();
            $link.show();
          }

          function inputKeyPress(paramIndex, e) {
            /*jshint validthis:true */
            if(e.which === 13) {
              inputBlur.call(this, paramIndex);
            }
          }

          function inputKeyDown() {
            /*jshint validthis:true */
            this.style.width = (3 + this.value.length) * 8 + 'px';
          }

          function addTypeahead($input, paramIndex) {
            $input.attr('data-provide', 'typeahead');

            var options = funcDef.params[paramIndex].options;
            if (funcDef.params[paramIndex].type === 'int') {
              options = _.map(options, function(val) { return val.toString(); });
            }

            $input.typeahead({
              source: options,
              minLength: 0,
              items: 20,
              updater: function (value) {
                setTimeout(function() {
                  inputBlur.call($input[0], paramIndex);
                }, 0);
                return value;
              }
            });

            var typeahead = $input.data('typeahead');
            typeahead.lookup = function () {
              this.query = this.$element.val() || '';
              return this.process(this.source);
            };
          }

          function toggleFuncControls() {
            var targetDiv = elem.closest('.tight-form');

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

            _.each(funcDef.params, function(param, index) {
              if (param.optional && func.params.length <= index) {
                return;
              }

              if (index > 0) {
                $('<span>, </span>').appendTo(elem);
              }

              var paramValue = templateSrv.highlightVariablesAsHtml(func.params[index]);
              var $paramLink = $('<a ng-click="" class="graphite-func-param-link">' + paramValue + '</a>');
              var $input = $(paramTemplate);

              paramCountAtLink++;

              $paramLink.appendTo(elem);
              $input.appendTo(elem);

              $input.blur(_.partial(inputBlur, index));
              $input.keyup(inputKeyDown);
              $input.keypress(_.partial(inputKeyPress, index));
              $paramLink.click(_.partial(clickFuncParam, index));

              if (funcDef.params[index].options) {
                addTypeahead($input, index);
              }

            });

            $('<span>)</span>').appendTo(elem);

            $compile(elem.contents())($scope);
          }

          function ifJustAddedFocusFistParam() {
            if ($scope.func.added) {
              $scope.func.added = false;
              setTimeout(function() {
                elem.find('.graphite-func-param-link').first().click();
              }, 10);
            }
          }

          function registerFuncControlsToggle() {
            $funcLink.click(toggleFuncControls);
          }

          function registerFuncControlsActions() {
            $funcControls.click(function(e) {
              var $target = $(e.target);
              if ($target.hasClass('fa-remove')) {
                toggleFuncControls();
                $scope.$apply(function() {
                  $scope.removeFunction($scope.func);
                });
                return;
              }

              if ($target.hasClass('fa-arrow-left')) {
                $scope.$apply(function() {
                  _.move($scope.functions, $scope.$index, $scope.$index - 1);
                  $scope.targetChanged();
                });
                return;
              }

              if ($target.hasClass('fa-arrow-right')) {
                $scope.$apply(function() {
                  _.move($scope.functions, $scope.$index, $scope.$index + 1);
                  $scope.targetChanged();
                });
                return;
              }

              if ($target.hasClass('fa-question-circle')) {
                window.open("http://graphite.readthedocs.org/en/latest/functions.html#graphite.render.functions." + funcDef.name,'_blank');
                return;
              }
            });
          }

          function relink() {
            elem.children().remove();

            addElementsAndCompile();
            ifJustAddedFocusFistParam();
            registerFuncControlsToggle();
            registerFuncControlsActions();
          }

          relink();
        }
      };

    });

});
