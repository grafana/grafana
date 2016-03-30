///<reference path="../../headers/common.d.ts" />

import config from 'app/core/config';
import _ from 'lodash';
import $ from 'jquery';
import coreModule from 'app/core/core_module';

var template = `
`;

export class DashboardSelectorCtrl {

  /** @ngInject */
  constructor(private $scope, private $rootScope) {
  }
}

export function dashboardSelector() {
  return {
    restrict: 'E',
    controller: DashboardSelectorCtrl,
    bindToController: true,
    controllerAs: 'ctrl',
    template: template,
  };
}

coreModule.directive('dashboardSelector', dashboardSelector);
