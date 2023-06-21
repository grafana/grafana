/**
 * Wrapper for the new ngReact <color-picker> directive for backward compatibility.
 * Allows remaining <spectrum-picker> untouched in outdated plugins.
 * Technically, it's just a wrapper for react component with two-way data binding support.
 */
import coreModule from '../core_module';

coreModule.directive('spectrumPicker', spectrumPicker);

export function spectrumPicker() {
  return {
    restrict: 'E',
    require: 'ngModel',
    scope: true,
    replace: true,
    template: '<color-picker color="ngModel.$viewValue" on-change="onColorChange"></color-picker>',
    link: (scope: any, element: any, attrs: any, ngModel: any) => {
      scope.ngModel = ngModel;
      scope.onColorChange = (color: string) => {
        ngModel.$setViewValue(color);
      };
    },
  };
}
