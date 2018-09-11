import _ from 'lodash';
import $ from 'jquery';
import coreModule from '../core_module';

/** @ngInject */
export function dropdownTypeahead($compile) {
  const inputTemplate =
    '<input type="text"' +
    ' class="gf-form-input input-medium tight-form-input"' +
    ' spellcheck="false" style="display:none"></input>';

  const buttonTemplate =
    '<a class="gf-form-label tight-form-func dropdown-toggle"' +
    ' tabindex="1" gf-dropdown="menuItems" data-toggle="dropdown"' +
    ' data-placement="top"><i class="fa fa-plus"></i></a>';

  return {
    scope: {
      menuItems: '=dropdownTypeahead',
      dropdownTypeaheadOnSelect: '&dropdownTypeaheadOnSelect',
      model: '=ngModel',
    },
    link: ($scope, elem, attrs) => {
      const $input = $(inputTemplate);
      const $button = $(buttonTemplate);
      $input.appendTo(elem);
      $button.appendTo(elem);

      if (attrs.linkText) {
        $button.html(attrs.linkText);
      }

      if (attrs.ngModel) {
        $scope.$watch('model', newValue => {
          _.each($scope.menuItems, item => {
            _.each(item.submenu, subItem => {
              if (subItem.value === newValue) {
                $button.html(subItem.text);
              }
            });
          });
        });
      }

      const typeaheadValues = _.reduce(
        $scope.menuItems,
        (memo, value, index) => {
          if (!value.submenu) {
            value.click = 'menuItemSelected(' + index + ')';
            memo.push(value.text);
          } else {
            _.each(value.submenu, (item, subIndex) => {
              item.click = 'menuItemSelected(' + index + ',' + subIndex + ')';
              memo.push(value.text + ' ' + item.text);
            });
          }
          return memo;
        },
        []
      );

      $scope.menuItemSelected = (index, subIndex) => {
        const menuItem = $scope.menuItems[index];
        const payload: any = { $item: menuItem };
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
        updater: value => {
          const result: any = {};
          _.each($scope.menuItems, menuItem => {
            _.each(menuItem.submenu, submenuItem => {
              if (value === menuItem.text + ' ' + submenuItem.text) {
                result.$subItem = submenuItem;
                result.$item = menuItem;
              }
            });
          });

          if (result.$item) {
            $scope.$apply(() => {
              $scope.dropdownTypeaheadOnSelect(result);
            });
          }

          $input.trigger('blur');
          return '';
        },
      });

      $button.click(() => {
        $button.hide();
        $input.show();
        $input.focus();
      });

      $input.keyup(() => {
        elem.toggleClass('open', $input.val() === '');
      });

      $input.blur(() => {
        $input.hide();
        $input.val('');
        $button.show();
        $button.focus();
        // clicking the function dropdown menu won't
        // work if you remove class at once
        setTimeout(() => {
          elem.removeClass('open');
        }, 200);
      });

      $compile(elem.contents())($scope);
    },
  };
}

/** @ngInject */
export function dropdownTypeahead2($compile) {
  const inputTemplate =
    '<input type="text"' + ' class="gf-form-input"' + ' spellcheck="false" style="display:none"></input>';

  const buttonTemplate =
    '<a class="gf-form-input dropdown-toggle"' +
    ' tabindex="1" gf-dropdown="menuItems" data-toggle="dropdown"' +
    ' data-placement="top"><i class="fa fa-plus"></i></a>';

  return {
    scope: {
      menuItems: '=dropdownTypeahead2',
      dropdownTypeaheadOnSelect: '&dropdownTypeaheadOnSelect',
      model: '=ngModel',
    },
    link: ($scope, elem, attrs) => {
      const $input = $(inputTemplate);
      const $button = $(buttonTemplate);
      $input.appendTo(elem);
      $button.appendTo(elem);

      if (attrs.linkText) {
        $button.html(attrs.linkText);
      }

      if (attrs.ngModel) {
        $scope.$watch('model', newValue => {
          _.each($scope.menuItems, item => {
            _.each(item.submenu, subItem => {
              if (subItem.value === newValue) {
                $button.html(subItem.text);
              }
            });
          });
        });
      }

      const typeaheadValues = _.reduce(
        $scope.menuItems,
        (memo, value, index) => {
          if (!value.submenu) {
            value.click = 'menuItemSelected(' + index + ')';
            memo.push(value.text);
          } else {
            _.each(value.submenu, (item, subIndex) => {
              item.click = 'menuItemSelected(' + index + ',' + subIndex + ')';
              memo.push(value.text + ' ' + item.text);
            });
          }
          return memo;
        },
        []
      );

      $scope.menuItemSelected = (index, subIndex) => {
        const menuItem = $scope.menuItems[index];
        const payload: any = { $item: menuItem };
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
        updater: value => {
          const result: any = {};
          _.each($scope.menuItems, menuItem => {
            _.each(menuItem.submenu, submenuItem => {
              if (value === menuItem.text + ' ' + submenuItem.text) {
                result.$subItem = submenuItem;
                result.$item = menuItem;
              }
            });
          });

          if (result.$item) {
            $scope.$apply(() => {
              $scope.dropdownTypeaheadOnSelect(result);
            });
          }

          $input.trigger('blur');
          return '';
        },
      });

      $button.click(() => {
        $button.hide();
        $input.show();
        $input.focus();
      });

      $input.keyup(() => {
        elem.toggleClass('open', $input.val() === '');
      });

      $input.blur(() => {
        $input.hide();
        $input.val('');
        $button.show();
        $button.focus();
        // clicking the function dropdown menu won't
        // work if you remove class at once
        setTimeout(() => {
          elem.removeClass('open');
        }, 200);
      });

      $compile(elem.contents())($scope);
    },
  };
}

coreModule.directive('dropdownTypeahead', dropdownTypeahead);
coreModule.directive('dropdownTypeahead2', dropdownTypeahead2);
