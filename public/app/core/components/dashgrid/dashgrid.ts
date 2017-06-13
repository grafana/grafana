///<reference path="../../../headers/common.d.ts" />

import $ from 'jquery';
import coreModule from '../../core_module';

import 'jquery-ui';
import 'gridstack';
import 'gridstack.jquery-ui';

export class DashGridCtrl {
}

const template = `
<div class="grid-stack">
    <div class="grid-stack-item"
        data-gs-x="0" data-gs-y="0"
        data-gs-width="4" data-gs-height="2">
            <div class="grid-stack-item-content"></div>
    </div>
    <div class="grid-stack-item"
        data-gs-x="4" data-gs-y="0"
        data-gs-width="4" data-gs-height="4">
            <div class="grid-stack-item-content"></div>
    </div>
</div>
`;

export function dashGrid() {
  return {
    restrict: 'E',
    template: template,
    controller: DashGridCtrl,
    bindToController: true,
    controllerAs: 'ctrl',
    scope: {
      dashboard: "="
    },
    link: function(scope, elem) {
      $('.grid-stack').gridstack();
    }
  };
}

coreModule.directive('dashGrid', dashGrid);
