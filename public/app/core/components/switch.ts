///<reference path="../../headers/common.d.ts" />

import config from 'app/core/config';
import _ from 'lodash';
import $ from 'jquery';
import coreModule from 'app/core/core_module';

var template = `
<label for="check-{{$id}}" class="gf-form-label {{ctrl.labelClass}} pointer">{{ctrl.label}}</label>
<div class="gf-form-switch {{ctrl.switchClass}}" ng-if="ctrl.show">
  <input id="check-{{$id}}" type="checkbox" ng-model="ctrl.checked" ng-change="ctrl.internalOnChange()">
  <label for="check-{{$id}}" data-on="Yes" data-off="No"></label>
</div>
`;

export class SwitchCtrl {
  onChange: any;
  checked: any;
  show: any;

  /** @ngInject */
  constructor() {
    this.show = true;
  }

  internalOnChange() {
    return new Promise(resolve => {
      setTimeout(() => {
        this.onChange();
        resolve();
      });
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
      switchClass: "@",
      onChange: "&",
    },
    template: template,
  };
}

coreModule.directive('gfFormSwitch', switchDirective);
