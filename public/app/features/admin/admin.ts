import  AdminListUsersCtrl from './admin_list_users_ctrl';
import  './adminListOrgsCtrl';
import  './adminEditOrgCtrl';
import  './adminEditUserCtrl';

import coreModule from 'app/core/core_module';

class AdminSettingsCtrl {

  /** @ngInject **/
  constructor($scope, backendSrv) {

    backendSrv.get('/api/admin/settings').then(function(settings) {
      $scope.settings = settings;
    });

  }
}

class AdminHomeCtrl {
  /** @ngInject **/
  constructor() {
  }
}

export class AdminStatsCtrl {
  stats: any;

  /** @ngInject */
  constructor(backendSrv: any) {
    backendSrv.get('/api/admin/stats').then(stats => {
      this.stats = stats;
    });
  }
}

coreModule.controller('AdminSettingsCtrl', AdminSettingsCtrl);
coreModule.controller('AdminHomeCtrl', AdminHomeCtrl);
coreModule.controller('AdminStatsCtrl', AdminStatsCtrl);
coreModule.controller('AdminListUsersCtrl', AdminListUsersCtrl);
