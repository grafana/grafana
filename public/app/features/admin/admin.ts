import  AdminListUsersCtrl from './admin_list_users_ctrl';
import  './adminListOrgsCtrl';
import  './adminEditOrgCtrl';
import  './adminEditUserCtrl';

import coreModule from 'app/core/core_module';

class AdminSettingsCtrl {
  navModel: any;

  /** @ngInject **/
  constructor($scope, backendSrv, navModelSrv) {
    this.navModel = navModelSrv.getAdminNav();

    backendSrv.get('/api/admin/settings').then(function(settings) {
      $scope.settings = settings;
    });

  }
}

class AdminHomeCtrl {
  navModel: any;

  /** @ngInject **/
  constructor(navModelSrv) {
    this.navModel = navModelSrv.getAdminNav();
  }
}

export class AdminStatsCtrl {
  stats: any;
  navModel: any;

  /** @ngInject */
  constructor(backendSrv: any, navModelSrv) {
    this.navModel = navModelSrv.getAdminNav();

    backendSrv.get('/api/admin/stats').then(stats => {
      this.stats = stats;
    });
  }
}

coreModule.controller('AdminSettingsCtrl', AdminSettingsCtrl);
coreModule.controller('AdminHomeCtrl', AdminHomeCtrl);
coreModule.controller('AdminStatsCtrl', AdminStatsCtrl);
coreModule.controller('AdminListUsersCtrl', AdminListUsersCtrl);
