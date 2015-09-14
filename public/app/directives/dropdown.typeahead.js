define([
  'angular',
  'lodash',
  'jquery',
],
function (angular, _, $) {
  'use strict';

  angular
    .module('grafana.directives')
    .directive('dropdownTypeahead', function($compile) {

      var inputTemplate = '<input type="text"'+
                            ' class="tight-form-input input-medium tight-form-input"' +
                            ' spellcheck="false" style="display:none"></input>';

      var buttonTemplate = '<a  class="tight-form-item tight-form-func dropdown-toggle"' +
                              ' tabindex="1" gf-dropdown="menuItems" data-toggle="dropdown"' +
                              ' data-placement="top"><i class="fa fa-plus"></i></a>';

      return {
        scope: {
          menuItems: "=dropdownTypeahead",
          dropdownTypeaheadOnSelect: "&dropdownTypeaheadOnSelect",
          model: '=ngModel'
        },
        link: function($scope, elem, attrs) {
          var $input = $(inputTemplate);
          var $button = $(buttonTemplate);
          $input.appendTo(elem);
          $button.appendTo(elem);

          if (attrs.linkText) {
            $button.html(attrs.linkText);
          }

          if (attrs.ngModel) {
            $scope.$watch('model', function(newValue) {
              _.each($scope.menuItems, function(item) {
                _.each(item.submenu, function(subItem) {
                  if (subItem.value === newValue) {
                    $button.html(subItem.text);
                  }
                });
              });
            });
          }

          var typeaheadValues = _.reduce($scope.menuItems, function(memo, value, index) {
            _.each(value.submenu, function(item, subIndex) {
              item.click = 'menuItemSelected(' + index + ',' + subIndex + ')';
              memo.push(value.text + ' ' + item.text);
            });
            return memo;
          }, []);

          $scope.menuItemSelected = function(index, subIndex) {
            var item = $scope.menuItems[index];
            $scope.dropdownTypeaheadOnSelect({$item: item, $subItem: item.submenu[subIndex]});
          };

          $input.attr('data-provide', 'typeahead');
          $input.typeahead({
            source: typeaheadValues,
            minLength: 1,
            items: 10,
            updater: function (value) {
              var result = {};
              _.each($scope.menuItems, function(menuItem) {
                _.each(menuItem.submenu, function(submenuItem) {
                  if (value === (menuItem.text + ' ' + submenuItem.text)) {
                    result.$item = menuItem;
                    result.$subItem = submenuItem;
                  }
                });
              });

              if (result.$item) {
                $scope.$apply(function() {
                  $scope.dropdownTypeaheadOnSelect(result);
                });
              }

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
            $input.hide();
            $input.val('');
            $button.show();
            $button.focus();
            // clicking the function dropdown menu wont
            // work if you remove class at once
            setTimeout(function() {
              elem.removeClass('open');
            }, 200);
          });

          $compile(elem.contents())($scope);
        }
      };
    });
});
