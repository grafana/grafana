import AdminEditOrgCtrl from './AdminEditOrgCtrl';

import coreModule from 'app/core/core_module';
import { NavModelSrv } from 'app/core/core';

class AdminHomeCtrl {
  navModel: any;

  /** @ngInject */
  constructor(navModelSrv: NavModelSrv) {
    this.navModel = navModelSrv.getNav('admin');
  }
}

coreModule.controller('AdminEditOrgCtrl', AdminEditOrgCtrl);
coreModule.controller('AdminHomeCtrl', AdminHomeCtrl);
