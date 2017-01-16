define([
  'angular',
  '../core_module',
  'spectrum',
],
function (angular, coreModule) {
  'use strict';

  coreModule.default.directive('spectrumPicker', function() {
    return {
      restrict: 'E',
      require: 'ngModel',
      scope: false,
      replace: true,
      template: "<span><input class='input-small' /></span>",
      link: function(scope, element, attrs, ngModel) {
        var input = element.find('input');
        var options = angular.extend({
          showAlpha: true,
          showButtons: false,
          color: ngModel.$viewValue,
          change: function(color) {
            scope.$apply(function() {
              ngModel.$setViewValue(color.toRgbString());
            });
          }
        }, scope.$eval(attrs.options));

        ngModel.$render = function() {
          input.spectrum('set', ngModel.$viewValue || '');
        };

        input.spectrum(options);

        scope.$on('$destroy', function() {
          input.spectrum('destroy');
        });
      }
    };
  });
});
