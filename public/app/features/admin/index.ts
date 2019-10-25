import AdminListUsersCtrl from './AdminListUsersCtrl';
import AdminEditUserCtrl from './AdminEditUserCtrl';
import AdminListOrgsCtrl from './AdminListOrgsCtrl';
import AdminEditOrgCtrl from './AdminEditOrgCtrl';
import StyleGuideCtrl from './StyleGuideCtrl';

import coreModule from 'app/core/core_module';
import { NavModelSrv } from 'app/core/core';

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
coreModule.controller('AdminHomeCtrl', AdminHomeCtrl);
coreModule.controller('StyleGuideCtrl', StyleGuideCtrl);
