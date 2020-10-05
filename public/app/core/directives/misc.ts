import angular from 'angular';
import Clipboard from 'clipboard';
import coreModule from '../core_module';
import kbn from 'app/core/utils/kbn';
import { appEvents } from 'app/core/core';
import { AppEvents } from '@grafana/data';

/** @ngInject */
function tip($compile: any) {
  return {
    restrict: 'E',
    link: (scope: any, elem: any, attrs: any) => {
      let _t =
        '<i class="grafana-tip fa fa-' +
        (attrs.icon || 'question-circle') +
        '" bs-tooltip="\'' +
        kbn.addSlashes(elem.text()) +
        '\'"></i>';
      _t = _t.replace(/{/g, '\\{').replace(/}/g, '\\}');
      elem.replaceWith($compile(angular.element(_t))(scope));
    },
  };
}

function clipboardButton() {
  return {
    scope: {
      getText: '&clipboardButton',
    },
    link: (scope: any, elem: any) => {
      scope.clipboard = new Clipboard(elem[0], {
        text: () => {
          return scope.getText();
        },
      });

      scope.clipboard.on('success', () => {
        appEvents.emit(AppEvents.alertSuccess, ['Content copied to clipboard']);
      });

      scope.$on('$destroy', () => {
        if (scope.clipboard) {
          scope.clipboard.destroy();
        }
      });
    },
  };
}

/** @ngInject */
function compile($compile: any) {
  return {
    restrict: 'A',
    link: (scope: any, element: any, attrs: any) => {
      scope.$watch(
        (scope: any) => {
          return scope.$eval(attrs.compile);
        },
        (value: any) => {
          element.html(value);
          $compile(element.contents())(scope);
        }
      );
    },
  };
}

function watchChange() {
  return {
    scope: { onchange: '&watchChange' },
    link: (scope: any, element: any) => {
      element.on('input', () => {
        scope.$apply(() => {
          scope.onchange({ inputValue: element.val() });
        });
      });
    },
  };
}

/** @ngInject */
function editorOptBool($compile: any) {
  return {
    restrict: 'E',
    link: (scope: any, elem: any, attrs: any) => {
      const ngchange = attrs.change ? ' ng-change="' + attrs.change + '"' : '';
      const tip = attrs.tip ? ' <tip>' + attrs.tip + '</tip>' : '';
      const showIf = attrs.showIf ? ' ng-show="' + attrs.showIf + '" ' : '';

      const template =
        '<div class="editor-option gf-form-checkbox text-center"' +
        showIf +
        '>' +
        ' <label for="' +
        attrs.model +
        '" class="small">' +
        attrs.text +
        tip +
        '</label>' +
        '<input class="cr1" id="' +
        attrs.model +
        '" type="checkbox" ' +
        '       ng-model="' +
        attrs.model +
        '"' +
        ngchange +
        '       ng-checked="' +
        attrs.model +
        '"></input>' +
        ' <label for="' +
        attrs.model +
        '" class="cr1"></label>';
      elem.replaceWith($compile(angular.element(template))(scope));
    },
  };
}

/** @ngInject */
function editorCheckbox($compile: any, $interpolate: any) {
  return {
    restrict: 'E',
    link: (scope: any, elem: any, attrs: any) => {
      const text = $interpolate(attrs.text)(scope);
      const model = $interpolate(attrs.model)(scope);
      const ngchange = attrs.change ? ' ng-change="' + attrs.change + '"' : '';
      const tip = attrs.tip ? ' <tip>' + attrs.tip + '</tip>' : '';
      const label = '<label for="' + scope.$id + model + '" class="checkbox-label">' + text + tip + '</label>';

      let template =
        '<input class="cr1" id="' +
        scope.$id +
        model +
        '" type="checkbox" ' +
        '       ng-model="' +
        model +
        '"' +
        ngchange +
        '       ng-checked="' +
        model +
        '"></input>' +
        ' <label for="' +
        scope.$id +
        model +
        '" class="cr1"></label>';

      template = template + label;
      elem.addClass('gf-form-checkbox');
      elem.html($compile(angular.element(template))(scope));
    },
  };
}

/** @ngInject */
function gfDropdown($parse: any, $compile: any, $timeout: any) {
  function buildTemplate(items: any, placement?: any) {
    const upclass = placement === 'top' ? 'dropup' : '';
    const ul = ['<ul class="dropdown-menu ' + upclass + '" role="menu" aria-labelledby="drop1">', '</ul>'];

    for (let index = 0; index < items.length; index++) {
      const item = items[index];

      if (item.divider) {
        ul.splice(index + 1, 0, '<li class="divider"></li>');
        continue;
      }

      let li =
        '<li' +
        (item.submenu && item.submenu.length ? ' class="dropdown-submenu"' : '') +
        '>' +
        '<a tabindex="-1" ng-href="' +
        (item.href || '') +
        '"' +
        (item.click ? ' ng-click="' + item.click + '"' : '') +
        (item.target ? ' target="' + item.target + '"' : '') +
        (item.method ? ' data-method="' + item.method + '"' : '') +
        '>' +
        (item.text || '') +
        '</a>';

      if (item.submenu && item.submenu.length) {
        li += buildTemplate(item.submenu).join('\n');
      }

      li += '</li>';
      ul.splice(index + 1, 0, li);
    }

    return ul;
  }

  return {
    restrict: 'EA',
    scope: true,
    link: function postLink(scope: any, iElement: any, iAttrs: any) {
      const getter = $parse(iAttrs.gfDropdown),
        items = getter(scope);
      $timeout(() => {
        const placement = iElement.data('placement');
        const dropdown = angular.element(buildTemplate(items, placement).join(''));
        dropdown.insertAfter(iElement);
        $compile(iElement.next('ul.dropdown-menu'))(scope);
      });

      iElement.addClass('dropdown-toggle').attr('data-toggle', 'dropdown');
    },
  };
}

coreModule.directive('tip', tip);
coreModule.directive('clipboardButton', clipboardButton);
coreModule.directive('compile', compile);
coreModule.directive('watchChange', watchChange);
coreModule.directive('editorOptBool', editorOptBool);
coreModule.directive('editorCheckbox', editorCheckbox);
coreModule.directive('gfDropdown', gfDropdown);
