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

      function openDropdown(inputEl, linkEl) {
        inputEl.css('width', (linkEl.width() + 16) + 'px');

        linkEl.hide();
        inputEl.show();
        inputEl.focus();
      };

      return {
        scope: {
          variable: "=",
          onUpdated: "&"
        },

        templateUrl: 'app/features/dashboard/partials/variableValueSelect.html',

        link: function(scope, elem) {
          var bodyEl = angular.element($window.document.body);
          var linkEl = elem.find('.variable-value-link');
          var inputEl = elem.find('input');
          var variable = scope.variable;
          var cancelBlur = null;

          scope.openDropdown = function() {
            inputEl.show();
            linkEl.hide();
            scope.dropdownVisible = true;

            inputEl.css('width', (linkEl.width() + 16) + 'px');

            linkEl.hide();
            inputEl.show();
            inputEl.focus();

            $timeout(function() { bodyEl.on('click', scope.bodyOnClick); }, 0, false);
          };

          scope.switchToLink = function(now) {
            if (now === true || cancelBlur) {
              clearTimeout(cancelBlur);
              cancelBlur = null;
              inputEl.hide();
              linkEl.show();
              scope.dropdownVisible = false;
              scope.$digest();

              scope.updateLinkText();
              scope.onUpdated();
            }
            else {
              // need to have long delay because the blur
              // happens long before the click event on the typeahead options
              cancelBlur = setTimeout(scope.switchToLink, 50);
            }

            bodyEl.off('click', scope.bodyOnClick);
          };

          scope.bodyOnClick = function(e) {
            if (elem.has(e.target).length === 0) {
              scope.switchToLink();
            }
          };

          scope.show = function() {
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
            scope.selectedValuesCount = currentValues.length;

            scope.openDropdown();
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
              scope.optionSelected(scope.search.options[scope.highlightIndex], {}, true, false);
            }
            if (evt.keyCode === 32) {
              scope.optionSelected(scope.search.options[scope.highlightIndex], {}, false, false);
            }
          };

          scope.moveHighlight = function(direction) {
            scope.highlightIndex = (scope.highlightIndex + direction) % scope.search.options.length;
          };

          scope.optionSelected = function(option, event, commitChange, excludeOthers) {
            if (!option) { return; }

            option.selected = !option.selected;

            commitChange = commitChange || false;
            excludeOthers = excludeOthers || false;

            var setAllExceptCurrentTo = function(newValue) {
              _.each(scope.options, function(other) {
                if (option !== other) { other.selected = newValue; }
              });
            };

            // commit action (enter key), should not deselect it
            if (commitChange) {
              option.selected = true;
            }

            if (option.text === 'All' || excludeOthers) {
              setAllExceptCurrentTo(false);
              commitChange = true;
            }
            else if (!variable.multi) {
              setAllExceptCurrentTo(false);
              commitChange = true;
            } else if (event.ctrlKey || event.metaKey || event.shiftKey) {
              commitChange = true;
              setAllExceptCurrentTo(false);
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

            scope.selectedValuesCount = variable.current.value.length;

            // only single value
            if (scope.selectedValuesCount === 1) {
              variable.current.value = selected[0].value;
            }

            if (commitChange) {
              scope.switchToLink();
            }
          };

          scope.updateLinkText = function() {
            scope.labelText = variable.label || '$' + variable.name;
            scope.linkText = variable.current.text;
          };

          scope.$watchGroup(['variable.hideLabel', 'variable.name', 'variable.label', 'variable.current.text'], function() {
            scope.updateLinkText();
          });

          linkEl.click(scope.openDropdown);
          //inputEl.blur(scope.switchToLink);
        },
      };
    });

});
