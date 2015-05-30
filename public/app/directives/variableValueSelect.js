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
    .controller('SelectDropdownCtrl', function($q) {
      var vm = this;

      vm.show = function() {
        vm.oldLinkText = vm.variable.current.text;
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
        vm.selectedTags = vm.selectedTags || [];

        if (!vm.tags) {
          vm.tags = _.map(vm.variable.tags, function(value) {
            return { text: value, selected: false };
          });
        }

        vm.dropdownVisible = true;
      };

      vm.updateLinkText = function() {
        vm.linkText = vm.variable.current.text;
        if (vm.oldLinkText && vm.oldLinkText !== vm.linkText) {
          vm.onUpdated();
        }
      };

      vm.clearSelections = function() {
        _.each(vm.options, function(option) {
          option.selected = false;
        });

        vm.selectionsChanged(false);
      };

      vm.selectTag = function(tag) {
        tag.selected = !tag.selected;
        var tagValuesPromise;
        if (!tag.values) {
          tagValuesPromise = vm.getValuesForTag({tagKey: tag.text});
          // if (tag.text === 'backend') {
          //   tag.values = ['backend_01', 'backend_02', 'backend_03', 'backend_04'];
          // } else {
          //   tag.values = ['web_server_01', 'web_server_02', 'web_server_03', 'web_server_04'];
          // }
        } else {
          tagValuesPromise = $q.when(tag.values);
        }

        tagValuesPromise.then(function(values) {
          tag.values = values;
          _.each(vm.options, function(option) {
            if (_.indexOf(tag.values, option.value) !== -1) {
              option.selected = tag.selected;
            }
          });

          vm.selectionsChanged(false);
        });
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

        vm.selectionsChanged(commitChange);
      };

      vm.selectionsChanged = function(commitChange) {
        var selected = _.filter(vm.options, {selected: true});

        if (selected.length > 1 && selected.length !== vm.options.length) {
          if (selected[0].text === 'All') {
            selected[0].selected = false;
            selected = selected.slice(1, selected.length);
          }
        }

        // validate selected tags
        _.each(vm.selectedTags, function(tag) {
          _.each(tag.values, function(value) {
            if (!_.findWhere(selected, {value: value})) {
              tag.selected = false;
            }
          });
        });

        vm.selectedTags = _.filter(vm.tags, {selected: true});

        var valuesNotInTag = _.filter(selected, function(test) {
          for (var i = 0; i < vm.selectedTags.length; i++) {
            var tag = vm.selectedTags[i];
            if (_.indexOf(tag.values, test.value) !== -1) {
              return false;
            }
          }
          return true;
        });

        vm.variable.current.value = _.pluck(selected, 'value');
        vm.variable.current.text = _.pluck(valuesNotInTag, 'text').join(', ');
        vm.selectedValuesCount = selected.length;

        // only single value
        if (vm.selectedValuesCount === 1) {
          vm.variable.current.value = selected[0].value;
        }

        if (commitChange) {
          vm.commitChanges();
        }
      };

      vm.commitChanges = function() {
        // make sure one option is selected
        var selected = _.filter(vm.options, {selected: true});
        if (selected.length === 0) {
          vm.options[0].selected = true;
          vm.selectionsChanged(false);
        }

        vm.dropdownVisible = false;
        vm.updateLinkText();
      };

      vm.queryChanged = function() {
        vm.highlightIndex = -1;
        vm.search.options = _.filter(vm.options, function(option) {
          return option.text.toLowerCase().indexOf(vm.search.query.toLowerCase()) !== -1;
        });
      };

      vm.init = function() {
        vm.updateLinkText();
      };

    });

  angular
    .module('grafana.directives')
    .directive('variableValueSelect', function($compile, $window, $timeout) {

      return {
        scope: { variable: "=", onUpdated: "&", getValuesForTag: "&" },
        templateUrl: 'app/features/dashboard/partials/variableValueSelect.html',
        controller: 'SelectDropdownCtrl',
        controllerAs: 'vm',
        bindToController: true,
        link: function(scope, elem) {
          var bodyEl = angular.element($window.document.body);
          var linkEl = elem.find('.variable-value-link');
          var inputEl = elem.find('input');

          function openDropdown() {
            inputEl.css('width', Math.max(linkEl.width(), 30) + 'px');

            inputEl.show();
            linkEl.hide();

            inputEl.focus();
            $timeout(function() { bodyEl.on('click', bodyOnClick); }, 0, false);
          }

          function switchToLink() {
            inputEl.hide();
            linkEl.show();
            bodyEl.off('click', bodyOnClick);
          }

          function bodyOnClick (e) {
            if (elem.has(e.target).length === 0) {
              scope.$apply(function() {
                scope.vm.commitChanges();
              });
            }
          }

          scope.$watch('vm.dropdownVisible', function(newValue) {
            if (newValue) {
              openDropdown();
            } else {
              switchToLink();
            }
          });

          scope.vm.init();
        },
      };
    });

});
