define([
  'kbn',
<<<<<<< 6bdfa28aeaae9b1754a9ff9a568ec1dd5c7ad294
  'app/core/core_module',
  'app/core/utils/rangeutil',
],
function (kbn, coreModule, rangeUtil) {
=======
  '../core_module',
],
function (kbn, coreModule) {
>>>>>>> refactor: improving structure, moving things into a core module
  'use strict';

  coreModule.directive('ngModelOnblur', function() {
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
      }
    };
  });

  coreModule.directive('emptyToNull', function () {
    return {
      restrict: 'A',
      require: 'ngModel',
      link: function (scope, elm, attrs, ctrl) {
        ctrl.$parsers.push(function (viewValue) {
          if(viewValue === "") { return null; }
          return viewValue;
        });
      }
    };
  });

  coreModule.directive('validTimeSpan', function() {
    return {
      require: 'ngModel',
      link: function(scope, elm, attrs, ctrl) {
        ctrl.$validators.integer = function(modelValue, viewValue) {
          if (ctrl.$isEmpty(modelValue)) {
            return true;
          }
<<<<<<< 6bdfa28aeaae9b1754a9ff9a568ec1dd5c7ad294
          var info = rangeUtil.describeTextRange(viewValue);
          return info.invalid !== true;
=======
          return kbn.isValidTimeSpan(viewValue);
>>>>>>> refactor: improving structure, moving things into a core module
        };
      }
    };
  });
});
