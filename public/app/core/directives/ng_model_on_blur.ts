import coreModule from '../core_module';
import * as rangeUtil from 'app/core/utils/rangeutil';

function ngModelOnBlur() {
  return {
    restrict: 'A',
    priority: 1,
    require: 'ngModel',
    link: function(scope, elm, attr, ngModelCtrl) {
      if (attr.type === 'radio' || attr.type === 'checkbox') {
        return;
      }

      elm.off('input keydown change');
      elm.bind('blur', function() {
        scope.$apply(function() {
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
    link: function(scope, elm, attrs, ctrl) {
      ctrl.$parsers.push(function(viewValue) {
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
    link: function(scope, elm, attrs, ctrl) {
      ctrl.$validators.integer = function(modelValue, viewValue) {
        if (ctrl.$isEmpty(modelValue)) {
          return true;
        }
        if (viewValue.indexOf('$') === 0 || viewValue.indexOf('+$') === 0) {
          return true; // allow template variable
        }
        var info = rangeUtil.describeTextRange(viewValue);
        return info.invalid !== true;
      };
    },
  };
}

coreModule.directive('ngModelOnblur', ngModelOnBlur);
coreModule.directive('emptyToNull', emptyToNull);
coreModule.directive('validTimeSpan', validTimeSpan);
