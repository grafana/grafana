define([
  'angular',
  'app',
  'lodash',
  'jquery',
],
function (angular, app, _) {
  'use strict';

  angular
    .module('grafana.controllers')
    .controller('VariableSelectCtrl', function($scope) {
      var vm = this;

      vm.beforeDropdownShow = function() {
        vm.oldCurrentText = vm.variable.current.text;
        vm.highlightIndex = -1;

        var currentValues = vm.variable.current.value;

        if (_.isString(currentValues)) {
          currentValues  = [currentValues];
        }

        vm.options = _.map(vm.variable.options, function(option) {
          if (_.indexOf(currentValues, option.value) >= 0) {
            option.selected = true;
          }
          return option;
        });

        vm.search = {query: '', options: vm.options};
        vm.selectedValuesCount = currentValues.length;
        vm.selectedTags = vm.selectedTag || [];

        if (!vm.tags) {
          vm.tags = _.map(vm.variable.tags, function(value) {
            return { text: value, selected: false };
          });
        }
      };

      vm.updateLinkText = function() {
        vm.labelText = vm.variable.label || '$' + vm.variable.name;
        vm.linkText = vm.variable.current.text;
      };

      vm.clearSelections = function() {
        _.each(vm.options, function(option) {
          option.selected = false;
        });

        vm.selectionsChanged(vm.options[0], false);
      };

      vm.selectTag = function(tag) {
        tag.selected = !tag.selected;
        if (!tag.values) {
          if (tag.text === 'backend') {
            tag.values = ['backend_01', 'backend_02', 'backend_03', 'backend_04'];
          } else {
            tag.values = ['web_server_01', 'web_server_02', 'web_server_03', 'web_server_04'];
          }
          console.log('querying for tag values');
        }

        _.each(vm.options, function(option) {
          if (_.indexOf(tag.values, option.value) !== -1) {
            option.selected = tag.selected;
          }
        });

        vm.selectedTags = _.filter(vm.tags, {selected: true});
        vm.selectionsChanged(vm.options[0], false);
      };

      vm.keyDown = function (evt) {
        if (evt.keyCode === 27) {
          vm.hide();
        }
        if (evt.keyCode === 40) {
          vm.moveHighlight(1);
        }
        if (evt.keyCode === 38) {
          vm.moveHighlight(-1);
        }
        if (evt.keyCode === 13) {
          vm.optionSelected(vm.search.options[vm.highlightIndex], {}, true, false);
        }
        if (evt.keyCode === 32) {
          vm.optionSelected(vm.search.options[vm.highlightIndex], {}, false, false);
        }
      };

      vm.moveHighlight = function(direction) {
        vm.highlightIndex = (vm.highlightIndex + direction) % vm.search.options.length;
      };

      vm.optionSelected = function(option, event, commitChange, excludeOthers) {
        if (!option) { return; }

        option.selected = !option.selected;

        commitChange = commitChange || false;
        excludeOthers = excludeOthers || false;

        var setAllExceptCurrentTo = function(newValue) {
          _.each(vm.options, function(other) {
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
        else if (!vm.variable.multi) {
          setAllExceptCurrentTo(false);
          commitChange = true;
        } else if (event.ctrlKey || event.metaKey || event.shiftKey) {
          commitChange = true;
          setAllExceptCurrentTo(false);
        }

        vm.selectionsChanged(option, commitChange);
      };

      vm.selectionsChanged = function(defaultItem, commitChange) {
        var selected = _.filter(vm.options, {selected: true});

        if (selected.length === 0) {
          defaultItem.selected = true;
          selected = [defaultItem];
        }

        if (selected.length > 1 && selected.length !== vm.options.length) {
          if (selected[0].text === 'All') {
            selected[0].selected = false;
            selected = selected.slice(1, selected.length);
          }
        }

        vm.variable.current = {
          text: _.pluck(selected, 'text').join(', '),
          value: _.pluck(selected, 'value'),
        };

        var valuesNotInTag = _.filter(selected, function(test) {
          for (var i = 0; i < vm.selectedTags.length; i++) {
            var tag = vm.selectedTags[i];
            if (_.indexOf(tag.values, test.value) !== -1) {
              return false;
            }
          }
          return true;
        });

        vm.variable.current.text = _.pluck(valuesNotInTag, 'text').join(', ');

        vm.selectedValuesCount = vm.variable.current.value.length;

        // only single value
        if (vm.selectedValuesCount === 1) {
          vm.variable.current.value = selected[0].value;
        }

        if (commitChange) {
          vm.switchToLink();
        }
      };

      vm.queryChanged = function() {
        vm.highlightIndex = -1;
        vm.search.options = _.filter(vm.options, function(option) {
          return option.text.toLowerCase().indexOf(vm.search.query.toLowerCase()) !== -1;
        });
      };

      $scope.$watchGroup(['vm.variable.hideLabel', 'vm.variable.name', 'vm.variable.label', 'vm.variable.current.text'], function() {
        vm.updateLinkText();
      });

    });

    angular
    .module('grafana.directives')
    .directive('variableValueSelect', function($compile, $window, $timeout) {

      return {
        scope: { variable: "=", onUpdated: "&" },
        templateUrl: 'app/features/dashboard/partials/variableValueSelect.html',
        controller: 'VariableSelectCtrl',
        controllerAs: 'vm',
        bindToController: true,
        link: function(scope, elem) {
          var vm = scope.vm;
          var bodyEl = angular.element($window.document.body);
          var linkEl = elem.find('.variable-value-link');
          var inputEl = elem.find('input');
          var cancelBlur = null;

          scope.openDropdown = function() {
            inputEl.show();
            linkEl.hide();
            vm.dropdownVisible = true;

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

              vm.dropdownVisible = false;
              scope.$digest();

              scope.vm.updateLinkText();
              scope.vm.onUpdated();
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
            vm.beforeDropdownShow();
            scope.openDropdown();
          };

          linkEl.click(scope.openDropdown);
        },
      };
    });

});
