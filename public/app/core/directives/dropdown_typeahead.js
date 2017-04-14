define([
  'lodash',
  'jquery',
  '../core_module',
],
function (_, $, coreModule) {
  'use strict';

  coreModule.directive('dropdownTypeahead', function($compile) {

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
          if (!value.submenu) {
            value.click = 'menuItemSelected(' + index + ')';
            memo.push(value.text);
          } else {
            _.each(value.submenu, function(item, subIndex) {
              item.click = 'menuItemSelected(' + index + ',' + subIndex + ')';
              memo.push(value.text + ' ' + item.text);
            });
          }
          return memo;
        }, []);

        $scope.menuItemSelected = function(index, subIndex) {
          var menuItem = $scope.menuItems[index];
          var payload = {$item: menuItem};
          if (menuItem.submenu && subIndex !== void 0) {
            payload.$subItem = menuItem.submenu[subIndex];
          }
          $scope.dropdownTypeaheadOnSelect(payload);
        };

        $input.attr('data-provide', 'typeahead');
        $input.typeahead({
          source: typeaheadValues,
          minLength: 1,
          items: 10,
          updater: function (value) {
            var result = {};
            _.each($scope.menuItems, function(menuItem) {
              result.$item = menuItem;

              _.each(menuItem.submenu, function(submenuItem) {
                if (value === (menuItem.text + ' ' + submenuItem.text)) {
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
