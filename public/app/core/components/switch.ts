///<reference path="../../headers/common.d.ts" />

import config from 'app/core/config';
import _ from 'lodash';
import $ from 'jquery';
import coreModule from 'app/core/core_module';
import Drop from 'tether-drop';

var template = `
<label for="check-{{ctrl.id}}" class="gf-form-label {{ctrl.labelClass}} pointer">{{ctrl.label}}</label>
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
    link: (scope, elem) => {
      if (scope.ctrl.tooltip) {
        var drop = new Drop({
          target: elem[0],
          content: scope.ctrl.tooltip,
          position: "right middle",
          classes: 'drop-help',
          openOn: 'hover',
          hoverOpenDelay: 400,
        });

        scope.$on('$destroy', function() {
          drop.destroy();
        });
      }
    }
  };
}

coreModule.directive('gfFormSwitch', switchDirective);
