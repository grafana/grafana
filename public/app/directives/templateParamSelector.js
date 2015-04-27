define([
  'angular',
  'app',
  'lodash',
  'jquery',
],
function (angular, app, _) {
  'use strict';

  angular
    .module('grafana.directives')
    .directive('variableValueSelect', function($compile, $window, $timeout) {
      return {
        scope: {
          variable: "=",
          onUpdated: "&"
        },
        templateUrl: 'app/features/dashboard/partials/variableValueSelect.html',
        link: function(scope, elem) {
          var bodyEl = angular.element($window.document.body);
          var variable = scope.variable;

          scope.show = function() {
            scope.selectorOpen = true;
            scope.giveFocus = 1;
            scope.oldCurrentText = variable.current.text;
            var currentValues = variable.current.value;

            if (_.isString(currentValues)) {
              currentValues  = [currentValues];
            }

            scope.options = _.map(variable.options, function(option) {
              if (_.indexOf(currentValues, option.value) >= 0) {
                option.selected = true;
              }
              return option;
            });

            $timeout(function() {
              bodyEl.on('click', scope.bodyOnClick);
            }, 0, false);
          };

          scope.optionSelected = function(option) {
            option.selected = !option.selected;

            if (!variable.multi || option.text === 'All') {
              _.each(scope.options, function(other) {
                if (option !== other) {
                  other.selected = false;
                }
              });
            }

            var selected = _.filter(scope.options, {selected: true});

            // enfore the first selected if no option is selected
            if (selected.length === 0) {
              scope.options[0].selected = true;
              selected = [scope.options[0]];
            }

            if (selected.length > 1) {
              if (selected[0].text === 'All') {
                selected[0].selected = false;
                selected = selected.slice(1, selected.length);
              }
            }

            variable.current = {
              text: _.pluck(selected, 'text').join(', '),
              value: _.pluck(selected, 'value'),
            };

            // only single value
            if (variable.current.value.length === 1) {
              variable.current.value = selected[0].value;
            }

            scope.updateLinkText();
            scope.onUpdated();
          };

          scope.hide = function() {
            scope.selectorOpen = false;
            // if (scope.oldCurrentText !== variable.current.text) {
            //   scope.onUpdated();
            // }

            bodyEl.off('click', scope.bodyOnClick);
          };

          scope.bodyOnClick = function(e) {
            var dropdown = elem.find('.variable-value-dropdown');
            if (dropdown.has(e.target).length === 0) {
              scope.$apply(scope.hide);
            }
          };

          scope.updateLinkText = function() {
            scope.linkText = "";
            if (!variable.hideLabel) {
              scope.linkText = (variable.label || variable.name) + ': ';
            }

            scope.linkText += variable.current.text;
          };

          scope.$watchGroup(['variable.hideLabel', 'variable.name', 'variable.label', 'variable.current.text'], function() {
            scope.updateLinkText();
          });
        },
      };
    });

});
