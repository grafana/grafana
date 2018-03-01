import angular from 'angular';
import Clipboard from 'clipboard';
import coreModule from '../core_module';
import kbn from 'app/core/utils/kbn';
import { appEvents } from 'app/core/core';

/** @ngInject */
function tip($compile) {
  return {
    restrict: 'E',
    link: function(scope, elem, attrs) {
      var _t =
        '<i class="grafana-tip fa fa-' +
        (attrs.icon || 'question-circle') +
        '" bs-tooltip="\'' +
        kbn.addslashes(elem.text()) +
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
    link: function(scope, elem) {
      scope.clipboard = new Clipboard(elem[0], {
        text: function() {
          return scope.getText();
        },
      });

      scope.clipboard.on('success', () => {
        appEvents.emit('alert-success', ['Content copied to clipboard']);
      });

      scope.$on('$destroy', function() {
        if (scope.clipboard) {
          scope.clipboard.destroy();
        }
      });
    },
  };
}

/** @ngInject */
function compile($compile) {
  return {
    restrict: 'A',
    link: function(scope, element, attrs) {
      scope.$watch(
        function(scope) {
          return scope.$eval(attrs.compile);
        },
        function(value) {
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
    link: function(scope, element) {
      element.on('input', function() {
        scope.$apply(function() {
          scope.onchange({ inputValue: element.val() });
        });
      });
    },
  };
}

/** @ngInject */
function editorOptBool($compile) {
  return {
    restrict: 'E',
    link: function(scope, elem, attrs) {
      var ngchange = attrs.change ? ' ng-change="' + attrs.change + '"' : '';
      var tip = attrs.tip ? ' <tip>' + attrs.tip + '</tip>' : '';
      var showIf = attrs.showIf ? ' ng-show="' + attrs.showIf + '" ' : '';

      var template =
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
function editorCheckbox($compile, $interpolate) {
  return {
    restrict: 'E',
    link: function(scope, elem, attrs) {
      var text = $interpolate(attrs.text)(scope);
      var model = $interpolate(attrs.model)(scope);
      var ngchange = attrs.change ? ' ng-change="' + attrs.change + '"' : '';
      var tip = attrs.tip ? ' <tip>' + attrs.tip + '</tip>' : '';
      var label = '<label for="' + scope.$id + model + '" class="checkbox-label">' + text + tip + '</label>';

      var template =
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
function gfDropdown($parse, $compile, $timeout) {
  function buildTemplate(items, placement?) {
    var upclass = placement === 'top' ? 'dropup' : '';
    var ul = ['<ul class="dropdown-menu ' + upclass + '" role="menu" aria-labelledby="drop1">', '</ul>'];

    for (let index = 0; index < items.length; index++) {
      let item = items[index];

      if (item.divider) {
        ul.splice(index + 1, 0, '<li class="divider"></li>');
        continue;
      }

      var li =
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
    link: function postLink(scope, iElement, iAttrs) {
      var getter = $parse(iAttrs.gfDropdown),
        items = getter(scope);
      $timeout(function() {
        var placement = iElement.data('placement');
        var dropdown = angular.element(buildTemplate(items, placement).join(''));
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
