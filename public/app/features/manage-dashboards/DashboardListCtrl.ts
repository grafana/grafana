import { NavModelSrv } from 'app/core/core';

export class DashboardListCtrl {
  navModel: any;

  /** @ngInject */
  constructor(navModelSrv: NavModelSrv) {
    this.navModel = navModelSrv.getNav('dashboards', 'manage-dashboards', 0);
  }
}
