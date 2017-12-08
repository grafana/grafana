define([
  'angular',
  'lodash',
  'jquery',
],
function (angular, _, $) {
  'use strict';

  angular
    .module('grafana.directives')
    .directive('graphiteAddFunc', function($compile) {
      var inputTemplate = '<input type="text"'+
                            ' class="gf-form-input"' +
                            ' spellcheck="false" style="display:none"></input>';

      var buttonTemplate = '<a  class="gf-form-label query-part dropdown-toggle"' +
                              ' tabindex="1" gf-dropdown="functionMenu" data-toggle="dropdown">' +
                              '<i class="fa fa-plus"></i></a>';

      return {
        link: function($scope, elem) {
          var ctrl = $scope.ctrl;

          var $input = $(inputTemplate);
          var $button = $(buttonTemplate);

          $input.appendTo(elem);
          $button.appendTo(elem);

          ctrl.datasource.getFuncDefs().then(function(funcDefs) {
            var allFunctions = _.map(funcDefs, 'name').sort();

            $scope.functionMenu = createFunctionDropDownMenu(funcDefs);

            $input.attr('data-provide', 'typeahead');
            $input.typeahead({
              source: allFunctions,
              minLength: 1,
              items: 10,
              updater: function (value) {
                var funcDef = ctrl.datasource.getFuncDef(value);
                if (!funcDef) {
                  // try find close match
                  value = value.toLowerCase();
                  funcDef = _.find(allFunctions, function(funcName) {
                    return funcName.toLowerCase().indexOf(value) === 0;
                  });

                  if (!funcDef) { return; }
                }

                $scope.$apply(function() {
                  ctrl.addFunction(funcDef);
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
          });
        }
      };
    });

  function createFunctionDropDownMenu(funcDefs) {
    var categories = {};

    _.forEach(funcDefs, function(funcDef) {
      if (!funcDef.category) {
        return;
      }
      if (!categories[funcDef.category]) {
        categories[funcDef.category] = [];
      }
      categories[funcDef.category].push({
        text: funcDef.name,
        click: "ctrl.addFunction('" + funcDef.name + "')",
      });
    });

    return _.sortBy(_.map(categories, function(submenu, category) {
      return {
        text: category,
        submenu: _.sortBy(submenu, 'text')
      };
    }), 'text');
  }
});
