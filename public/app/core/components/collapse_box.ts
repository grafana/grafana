///<reference path="../../headers/common.d.ts" />

import coreModule from 'app/core/core_module';

const template = `
<div class="collapse-box">
  <div class="collapse-box__header">
    <a class="collapse-box__header-title pointer" ng-click="ctrl.toggle()">
      <span class="fa fa-fw fa-caret-right" ng-hide="ctrl.isOpen"></span>
      <span class="fa fa-fw fa-caret-down" ng-hide="!ctrl.isOpen"></span>
      {{ctrl.title}}
    </a>
    <div class="collapse-box__header-actions" ng-transclude="actions"></div>
  </div>
  <div class="collapse-box__body" ng-transclude="body" ng-if="ctrl.isOpen">
  </div>
</div>
`;

export class CollapseBoxCtrl {
  isOpen: boolean;
  onOpen: () => void;

  /** @ngInject **/
  constructor() {
    this.isOpen = false;
  }

  toggle() {
    this.isOpen = !this.isOpen;
    if (this.isOpen) {
      this.onOpen();
    }
  }
}

export function collapseBox() {
  return {
    restrict: 'E',
    template: template,
    controller: CollapseBoxCtrl,
    bindToController: true,
    controllerAs: 'ctrl',
    scope: {
      "title": "@",
      "isOpen": "=?",
      "onOpen": "&"
    },
    transclude: {
      'actions': '?collapseBoxActions',
      'body': 'collapseBoxBody',
    },
    link: function(scope, elem, attrs) {
    }
  };
}

coreModule.directive('collapseBox', collapseBox);
