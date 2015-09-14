define([
  'angular',
  'lodash',
  'jquery',
  './gfunc',
],
function (angular, _, $, gfunc) {
  'use strict';

  angular
    .module('grafana.directives')
    .directive('graphiteAddFunc', function($compile) {
      var inputTemplate = '<input type="text"'+
                            ' class="tight-form-input input-medium tight-form-input"' +
                            ' spellcheck="false" style="display:none"></input>';

      var buttonTemplate = '<a  class="tight-form-item tight-form-func dropdown-toggle"' +
                              ' tabindex="1" gf-dropdown="functionMenu" data-toggle="dropdown"' +
                              ' data-placement="top"><i class="fa fa-plus"></i></a>';

      return {
        link: function($scope, elem) {
          var categories = gfunc.getCategories();
          var allFunctions = getAllFunctionNames(categories);

          $scope.functionMenu = createFunctionDropDownMenu(categories);

          var $input = $(inputTemplate);
          var $button = $(buttonTemplate);
          $input.appendTo(elem);
          $button.appendTo(elem);

          $input.attr('data-provide', 'typeahead');
          $input.typeahead({
            source: allFunctions,
            minLength: 1,
            items: 10,
            updater: function (value) {
              var funcDef = gfunc.getFuncDef(value);
              if (!funcDef) {
                // try find close match
                value = value.toLowerCase();
                funcDef = _.find(allFunctions, function(funcName) {
                  return funcName.toLowerCase().indexOf(value) === 0;
                });

                if (!funcDef) { return; }
              }

              $scope.$apply(function() {
                $scope.addFunction(funcDef);
              });

              $input.trigger('blur');
              return '';
            }
          });

          $button.click(function() {
            $button.hide();
            $input.show();
            $input.focus();
          });

          $input.keyup(function() {
            elem.toggleClass('open', $input.val() === '');
          });

          $input.blur(function() {
            // clicking the function dropdown menu wont
            // work if you remove class at once
            setTimeout(function() {
              $input.val('');
              $input.hide();
              $button.show();
              elem.removeClass('open');
            }, 200);
          });

          $compile(elem.contents())($scope);
        }
      };
    });

  function getAllFunctionNames(categories) {
    return _.reduce(categories, function(list, category) {
      _.each(category, function(func) {
        list.push(func.name);
      });
      return list;
    }, []);
  }

  function createFunctionDropDownMenu(categories) {
    return _.map(categories, function(list, category) {
      return {
        text: category,
        submenu: _.map(list, function(value) {
          return {
            text: value.name,
            click: "addFunction('" + value.name + "')",
          };
        })
      };
    });
  }
});
