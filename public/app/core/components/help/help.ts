///<reference path="../../../headers/common.d.ts" />

import coreModule from '../../core_module';

export class HelpCtrl {
  tabIndex: any;
  shortcuts: any;

  /** @ngInject */
  constructor(private $scope) {
    this.tabIndex = 0;
    this.shortcuts = {
      'Global': [
      ]
    };
  }
}

export function helpModal() {
  return {
    restrict: 'E',
    templateUrl: 'public/app/core/components/help/help.html',
    controller: HelpCtrl,
    bindToController: true,
    transclude: true,
    controllerAs: 'ctrl',
    scope: {},
  };
}

coreModule.directive('helpModal', helpModal);
