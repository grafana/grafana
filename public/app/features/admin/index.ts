import AdminListUsersCtrl from './AdminListUsersCtrl';
import AdminEditUserCtrl from './AdminEditUserCtrl';
import AdminListOrgsCtrl from './AdminListOrgsCtrl';
import AdminEditOrgCtrl from './AdminEditOrgCtrl';
import StyleGuideCtrl from './StyleGuideCtrl';

import coreModule from 'app/core/core_module';
import { BackendSrv } from 'app/core/services/backend_srv';
import { NavModelSrv } from 'app/core/core';

class AdminSettingsCtrl {
  navModel: any;

  /** @ngInject */
  constructor($scope: any, backendSrv: BackendSrv, navModelSrv: NavModelSrv) {
    this.navModel = navModelSrv.getNav('admin', 'server-settings', 0);

    backendSrv.get('/api/admin/settings').then((settings: any) => {
      $scope.settings = settings;
    });
  }
}

class AdminHomeCtrl {
  navModel: any;

  /** @ngInject */
  constructor(navModelSrv: NavModelSrv) {
    this.navModel = navModelSrv.getNav('admin');
  }
}

coreModule.controller('AdminListUsersCtrl', AdminListUsersCtrl);
coreModule.controller('AdminEditUserCtrl', AdminEditUserCtrl);
coreModule.controller('AdminListOrgsCtrl', AdminListOrgsCtrl);
coreModule.controller('AdminEditOrgCtrl', AdminEditOrgCtrl);
coreModule.controller('AdminSettingsCtrl', AdminSettingsCtrl);
coreModule.controller('AdminHomeCtrl', AdminHomeCtrl);
coreModule.controller('StyleGuideCtrl', StyleGuideCtrl);
