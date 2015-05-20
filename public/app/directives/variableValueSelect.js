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
    .directive('variableValueSelect', function($compile, $window, $timeout, datasourceSrv) {
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
            if (scope.selectorOpen) {
              return;
            }

            scope.selectorOpen = true;
            scope.giveFocus = 1;
            scope.oldCurrentText = variable.current.text;
            scope.highlightIndex = -1;

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

            scope.search = {query: '', options: scope.options};

            $timeout(function() {
              bodyEl.on('click', scope.bodyOnClick);
            }, 0, false);
          };

          scope.queryChanged = function() {
            scope.highlightIndex = -1;
            scope.search.options = _.filter(scope.options, function(option) {
              return option.text.toLowerCase().indexOf(scope.search.query.toLowerCase()) !== -1;
            });
          };

          scope.keyDown = function (evt) {
            if (evt.keyCode === 27) {
              scope.hide();
            }
            if (evt.keyCode === 40) {
              scope.moveHighlight(1);
            }
            if (evt.keyCode === 38) {
              scope.moveHighlight(-1);
            }
            if (evt.keyCode === 13) {
              scope.optionSelected(scope.search.options[scope.highlightIndex], {});
            }
          };

          scope.moveHighlight = function(direction) {
            scope.highlightIndex = (scope.highlightIndex + direction) % scope.search.options.length;
          };

          scope.optionSelected = function(option, event) {
            option.selected = !option.selected;

            var hideAfter = true;
            var setAllExceptCurrentTo = function(newValue) {
              _.each(scope.options, function(other) {
                if (option !== other) { other.selected = newValue; }
              });
            };

            if (option.text === 'All') {
              setAllExceptCurrentTo(false);
            }
            else if (!variable.multi) {
              setAllExceptCurrentTo(false);
            } else {
              if (event.ctrlKey || event.metaKey || event.shiftKey) {
                hideAfter = false;
              }
              else {
                setAllExceptCurrentTo(false);
              }
            }

            var selected = _.filter(scope.options, {selected: true});

            if (selected.length === 0) {
              option.selected = true;
              selected = [option];
            }

            if (selected.length > 1 && selected.length !== scope.options.length) {
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

            if (hideAfter) {
              scope.hide();
            }
          };

          scope.selectTag = function(tag) {
          };

          scope.hide = function() {
            scope.selectorOpen = false;
            bodyEl.off('click', scope.bodyOnClick);
          };

          scope.bodyOnClick = function(e) {
            var dropdown = elem.find('.variable-value-dropdown');
            if (dropdown.has(e.target).length === 0) {
              scope.$apply(scope.hide);
            }
          };

          scope.updateLinkText = function() {
            scope.labelText = variable.label || '$' + variable.name;
            scope.linkText = variable.current.text;
          };

          scope.$watchGroup(['variable.hideLabel', 'variable.name', 'variable.label', 'variable.current.text'], function() {
            scope.updateLinkText();
          });
        },
      };
    });

});
