import { rangeUtil } from '@grafana/data';

import coreModule from './core_module';

function ngModelOnBlur() {
  return {
    restrict: 'A',
    priority: 1,
    require: 'ngModel',
    link: (scope: any, elm: any, attr: any, ngModelCtrl: any) => {
      if (attr.type === 'radio' || attr.type === 'checkbox') {
        return;
      }

      elm.off('input keydown change');
      elm.bind('blur', () => {
        scope.$apply(() => {
          ngModelCtrl.$setViewValue(elm.val());
        });
      });
    },
  };
}

function emptyToNull() {
  return {
    restrict: 'A',
    require: 'ngModel',
    link: (scope: any, elm: any, attrs: any, ctrl: any) => {
      ctrl.$parsers.push((viewValue: any) => {
        if (viewValue === '') {
          return null;
        }
        return viewValue;
      });
    },
  };
}

function validTimeSpan() {
  return {
    require: 'ngModel',
    link: (scope: any, elm: any, attrs: any, ctrl: any) => {
      ctrl.$validators.integer = (modelValue: any, viewValue: any) => {
        if (ctrl.$isEmpty(modelValue)) {
          return true;
        }
        if (viewValue.indexOf('$') === 0 || viewValue.indexOf('+$') === 0) {
          return true; // allow template variable
        }
        const info = rangeUtil.describeTextRange(viewValue);
        return info.invalid !== true;
      };
    },
  };
}

coreModule.directive('ngModelOnblur', ngModelOnBlur);
coreModule.directive('emptyToNull', emptyToNull);
coreModule.directive('validTimeSpan', validTimeSpan);
