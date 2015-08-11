define([
  'angular',
  'lodash',
  'jquery',
],
function (angular, _, $) {
  'use strict';

  angular
    .module('grafana.directives')
    .directive('influxdbFuncEditor', function($compile) {

      var funcSpanTemplate = '<a gf-dropdown="functionMenu" class="dropdown-toggle" ' +
                             'data-toggle="dropdown">{{field.func}}</a><span>(</span>';

      var paramTemplate = '<input type="text" style="display:none"' +
                          ' class="input-mini tight-form-func-param"></input>';

      var functionList = [
        'count', 'mean', 'sum', 'min', 'max', 'mode', 'distinct', 'median',
        'derivative', 'non_negative_derivative', 'stddev', 'first', 'last', 'difference'
      ];

      var functionMenu = _.map(functionList, function(func) {
        return { text: func, click: "changeFunction('" + func + "');" };
      });

      return {
        restrict: 'A',
        scope: {
          field: "=",
          getFields: "&",
          onChange: "&",
        },
        link: function postLink($scope, elem) {
          var $funcLink = $(funcSpanTemplate);

          $scope.functionMenu = functionMenu;

          $scope.changeFunction = function(func) {
            $scope.field.func = func;
            $scope.onChange();
          };

          function clickFuncParam() {
            /*jshint validthis:true */

            var $link = $(this);
            var $input = $link.next();

            $input.val($scope.field.name);
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

          function inputBlur() {
            /*jshint validthis:true */

            var $input = $(this);
            var $link = $input.prev();

            if ($input.val() !== '') {
              $link.text($input.val());

              $scope.field.name = $input.val();
              $scope.$apply($scope.onChange());
            }

            $input.hide();
            $link.show();
          }

          function inputKeyPress(e) {
            /*jshint validthis:true */

            if(e.which === 13) {
              inputBlur.call(this);
            }
          }

          function inputKeyDown() {
            /*jshint validthis:true */
            this.style.width = (3 + this.value.length) * 8 + 'px';
          }

          function addTypeahead($input) {
            $input.attr('data-provide', 'typeahead');

            $input.typeahead({
              source: function (query, callback) {
                return $scope.getFields().then(function(results) {
                  callback(results);
                });
              },
              minLength: 0,
              items: 20,
              updater: function (value) {
                setTimeout(function() {
                  inputBlur.call($input[0]);
                }, 0);
                return value;
              }
            });

            var typeahead = $input.data('typeahead');
            typeahead.lookup = function () {
              var items;
              this.query = this.$element.val() || '';
              items = this.source(this.query, $.proxy(this.process, this));
              return items ? this.process(items) : items;
            };
          }

          function addElementsAndCompile() {
            $funcLink.appendTo(elem);

            var $paramLink = $('<a ng-click="" class="graphite-func-param-link">' + $scope.field.name + '</a>');
            var $input = $(paramTemplate);

            $paramLink.appendTo(elem);
            $input.appendTo(elem);

            $input.blur(inputBlur);
            $input.keyup(inputKeyDown);
            $input.keypress(inputKeyPress);
            $paramLink.click(clickFuncParam);

            addTypeahead($input);

            $('<span>)</span>').appendTo(elem);

            $compile(elem.contents())($scope);
          }

          addElementsAndCompile();

        }
      };

    });

});
