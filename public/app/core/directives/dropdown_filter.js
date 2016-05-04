/**
 * Created by madshall on 5/4/16.
 */
define([
  'angular',
  'lodash',
  '../core_module',
  'app/core/store'
], function (angular, _, coreModule, store) {
  'use strict';

  var uniqueId = 1;

  coreModule.default.controller('dropdownFilterCtrl', function() {
    this.id = 'filterDropdown' + uniqueId++;
    this.giveSearchFocus = 0;
    this.query = '';

    this.optionsFilter = function(options) {
      var result = [];

      for (var i = 0; i < options.length; i++) {
        if (!options[i].hidden) {
          result.push(options[i]);
        }
      }

      return result;
    };
  });

  coreModule.default.directive('dropdownFilter', function() {
    return {
      restrict: 'AE',
      scope: {
        options: '='
      },
      controller: 'dropdownFilterCtrl',
      controllerAs: 'df',
      bindToController: true,
      templateUrl: 'public/app/partials/dropdownFilter.html',
      link: function(scope) {
        document.addEventListener("click", function(event) {
          scope.$apply(function() {
            if (event.target.id !== 'selectBox' && event.target.parentNode.id !== 'selectBox') {
              scope.hide();
            }
          });
        });

        scope.$watch("df.options", function(newValue) {
          if (newValue && newValue.length) {
            var newValueFiltered = scope.df.optionsFilter(newValue);
            if (newValueFiltered.length !== newValue.length) {
              scope.df.options = newValueFiltered;
              return;
            }
            var lastSelectedValue = store.get(scope.df.id);
            var index = -1;
            for (var i = 0; i < scope.df.options.length; i++) {
              if (scope.df.options[i].text === lastSelectedValue) {
                index = i;
                break;
              }
            }
            scope.selectedItem = scope.df.options[index === -1 ? 0 : index];
            store.set(scope.df.id, scope.selectedItem.text);
            if (index === -1) {
              scope.notifyParents();
            }
          }
        });

        scope.search = function() {
          scope.notifyParents();
        };

        scope.notifyParents = function() {
          scope.$emit('filter', {column: scope.selectedItem, query: scope.df.query});
        };

        scope.show = function() {
          scope.visible = true;
        };

        scope.hide = function() {
          scope.visible = false;
        };

        scope.selectValue = function(item) {
          scope.selectedItem = item;
          store.set(scope.df.id, scope.selectedItem.text);
          scope.df.giveSearchFocus++;
          scope.notifyParents();
          scope.hide();
        };
      }
    };
  });
});