import AdminListUsersCtrl from './AdminListUsersCtrl';
import AdminEditUserCtrl from './AdminEditUserCtrl';
import AdminListOrgsCtrl from './AdminListOrgsCtrl';
import AdminEditOrgCtrl from './AdminEditOrgCtrl';
import StyleGuideCtrl from './StyleGuideCtrl';

import config from 'app/core/config';
import coreModule from 'app/core/core_module';

class AdminSettingsCtrl {
  navModel: any;

  /** @ngInject */
  constructor($scope, backendSrv, navModelSrv) {
    this.navModel = navModelSrv.getNav('cfg', 'admin', 'server-settings', 1);

    backendSrv.get('/api/admin/settings').then(settings => {
      $scope.settings = settings;
    });
  }
}

class AdminHomeCtrl {
  navModel: any;

  /** @ngInject */
  constructor(navModelSrv) {
    this.navModel = navModelSrv.getNav('cfg', 'admin', 1);
  }
}

coreModule.controller('AdminListUsersCtrl', AdminListUsersCtrl);
coreModule.controller('AdminEditUserCtrl', AdminEditUserCtrl);
coreModule.controller('AdminListOrgsCtrl', AdminListOrgsCtrl);
coreModule.controller('AdminEditOrgCtrl', AdminEditOrgCtrl);
coreModule.controller('AdminSettingsCtrl', AdminSettingsCtrl);
coreModule.controller('AdminHomeCtrl', AdminHomeCtrl);
coreModule.controller('StyleGuideCtrl', StyleGuideCtrl);

if (config.buildInfo.isEnterprise) {
  class AdminLicensingCtrl {
    navModel: any;

    /** @ngInject */
    constructor($scope, backendSrv, navModelSrv) {
      this.navModel = navModelSrv.getNav('cfg', 'admin', 'licensing', 1);

      backendSrv.get('/api/licensing/token').then(token => {
        token.maxUsers = token.max_users >= 0 ? token.max_users : 'Unlimited';
        $scope.token = token;
      });
    }
  }

  coreModule.controller('AdminLicensingCtrl', AdminLicensingCtrl);
}
