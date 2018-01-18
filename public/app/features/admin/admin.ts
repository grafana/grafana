import AdminListUsersCtrl from './admin_list_users_ctrl';
import './admin_list_orgs_ctrl';
import './admin_edit_org_ctrl';
import './admin_edit_user_ctrl';

import coreModule from 'app/core/core_module';

class AdminSettingsCtrl {
  navModel: any;

  /** @ngInject **/
  constructor($scope, backendSrv, navModelSrv) {
    this.navModel = navModelSrv.getNav('cfg', 'admin', 'server-settings', 1);

    backendSrv.get('/api/admin/settings').then(function(settings) {
      $scope.settings = settings;
    });
  }
}

class AdminHomeCtrl {
  navModel: any;

  /** @ngInject **/
  constructor(navModelSrv) {
    this.navModel = navModelSrv.getNav('cfg', 'admin', 1);
  }
}

export class AdminStatsCtrl {
  stats: any;
  navModel: any;

  /** @ngInject */
  constructor(backendSrv: any, navModelSrv) {
    this.navModel = navModelSrv.getNav('cfg', 'admin', 'server-stats', 1);

    backendSrv.get('/api/admin/stats').then(stats => {
      this.stats = stats;
    });
  }
}

coreModule.controller('AdminSettingsCtrl', AdminSettingsCtrl);
coreModule.controller('AdminHomeCtrl', AdminHomeCtrl);
coreModule.controller('AdminStatsCtrl', AdminStatsCtrl);
coreModule.controller('AdminListUsersCtrl', AdminListUsersCtrl);
