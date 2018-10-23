export class DashboardListCtrl {
  navModel: any;

  /** @ngInject */
  constructor(navModelSrv) {
    this.navModel = navModelSrv.getNav('dashboards', 'manage-dashboards', 0);
  }
}
