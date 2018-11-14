import coreModule from 'app/core/core_module';
import { DashboardModel } from '../dashboard/dashboard_model';

export class GeneralTabCtrl {
  panelCtrl: any;

  /** @ngInject */
  constructor($scope) {
    this.panelCtrl = $scope.ctrl;
  }
}

/** @ngInject */
export function generalTab() {
  'use strict';
  return {
    restrict: 'E',
    templateUrl: 'public/app/features/panel/partials/general_tab.html',
    controller: GeneralTabCtrl,
  };
}

coreModule.directive('panelGeneralTab', generalTab);
