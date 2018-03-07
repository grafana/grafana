///<reference path="../../headers/common.d.ts" />

import config from 'app/core/config';
import _ from 'lodash';
import $ from 'jquery';
import coreModule from 'app/core/core_module';
import Drop from 'tether-drop';

var template = `
<label for="check-{{ctrl.id}}" class="gf-form-label {{ctrl.labelClass}} pointer" ng-show="ctrl.label">
  {{ctrl.label}}
  <info-popover mode="right-normal" ng-if="ctrl.tooltip" position="top center">
    {{ctrl.tooltip}}
  </info-popover>
</label>
<div class="gf-form-switch {{ctrl.switchClass}}" ng-if="ctrl.show">
  <input id="check-{{ctrl.id}}" type="checkbox" ng-model="ctrl.checked" ng-change="ctrl.internalOnChange()">
  <label for="check-{{ctrl.id}}" data-on="Yes" data-off="No"></label>
</div>
`;

export class SwitchCtrl {
  onChange: any;
  checked: any;
  show: any;
  id: any;
  label: string;

  /** @ngInject */
  constructor($scope, private $timeout) {
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
      checked: "=",
      label: "@",
      labelClass: "@",
      tooltip: "@",
      switchClass: "@",
      onChange: "&",
    },
    template: template,
  };
}

coreModule.directive('gfFormSwitch', switchDirective);
