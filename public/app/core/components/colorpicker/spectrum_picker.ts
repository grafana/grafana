/**
 * Wrapper for the new ngReact <color-picker> directive for backward compatibility.
 * Allows remaining <spectrum-picker> untouched in outdated plugins.
 * Technically, it's just a wrapper for react component with two-way data binding support.
 */
import coreModule from '../../core_module';

/** @ngInject */
export function spectrumPicker() {
  return {
    restrict: 'E',
    require: 'ngModel',
    scope: true,
    replace: true,
    template: '<color-picker color="ngModel.$viewValue" onChange="onColorChange"></color-picker>',
    link: function(scope, element, attrs, ngModel) {
      scope.ngModel = ngModel;
      scope.onColorChange = color => {
        ngModel.$setViewValue(color);
      };
    },
  };
}
coreModule.directive('spectrumPicker', spectrumPicker);
