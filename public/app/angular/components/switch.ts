import coreModule from 'app/angular/core_module';

const template = `
<label for="check-{{ctrl.id}}" class="gf-form-switch-container">
  <div class="gf-form-label {{ctrl.labelClass}}" ng-show="ctrl.label">
    {{ctrl.label}}
    <info-popover mode="right-normal" ng-if="ctrl.tooltip" position="top center">
      {{ctrl.tooltip}}
    </info-popover>
  </div>
  <div class="gf-form-switch {{ctrl.switchClass}}" ng-if="ctrl.show">
    <input id="check-{{ctrl.id}}" type="checkbox" ng-model="ctrl.checked" ng-change="ctrl.internalOnChange()">
    <span class="gf-form-switch__slider"></span>
  </div>
</label>
`;

const checkboxTemplate = `
<label for="check-{{ctrl.id}}" class="gf-form-switch-container">
   <div class="gf-form-label {{ctrl.labelClass}}" ng-show="ctrl.label">
    {{ctrl.label}}
    <info-popover mode="right-normal" ng-if="ctrl.tooltip" position="top center">
      {{ctrl.tooltip}}
    </info-popover>
  </div>
  <div class="gf-form-checkbox {{ctrl.switchClass}}" ng-if="ctrl.show">
    <input id="check-{{ctrl.id}}" type="checkbox" ng-model="ctrl.checked" ng-change="ctrl.internalOnChange()">
    <span class="gf-form-switch__checkbox"></span>
  </div>
</label>
`;

export class SwitchCtrl {
  onChange: any;
  checked: any;
  show: any;
  id: any;
  label?: string;

  static $inject = ['$scope', '$timeout'];

  constructor($scope: any, private $timeout: any) {
    this.show = true;
    this.id = $scope.$id;
  }

  internalOnChange() {
    return this.$timeout(() => {
      return this.onChange();
    });
  }
}

export function switchDirective() {
  return {
    restrict: 'E',
    controller: SwitchCtrl,
    controllerAs: 'ctrl',
    bindToController: true,
    scope: {
      checked: '=',
      label: '@',
      labelClass: '@',
      tooltip: '@',
      switchClass: '@',
      onChange: '&',
    },
    template: template,
  };
}

export function checkboxDirective() {
  return {
    restrict: 'E',
    controller: SwitchCtrl,
    controllerAs: 'ctrl',
    bindToController: true,
    scope: {
      checked: '=',
      label: '@',
      labelClass: '@',
      tooltip: '@',
      switchClass: '@',
      onChange: '&',
    },
    template: checkboxTemplate,
  };
}

coreModule.directive('gfFormSwitch', switchDirective);
coreModule.directive('gfFormCheckbox', checkboxDirective);
