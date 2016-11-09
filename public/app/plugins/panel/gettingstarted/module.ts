///<reference path="../../../headers/common.d.ts" />

import {PanelCtrl} from 'app/plugins/sdk';

import {contextSrv} from 'app/core/core';

class GettingStartedPanelCtrl extends PanelCtrl {
  static templateUrl = 'public/app/plugins/panel/gettingstarted/module.html';
  hasDatasources: boolean;
  checksDone: boolean;

  /** @ngInject **/
  constructor($scope, $injector, private backendSrv, private datasourceSrv) {
    super($scope, $injector);

    /* tslint:disable */
    if (contextSrv.user.helpFlags1 & 1) {
      this.row.removePanel(this.panel, false);
      return;
    }
    /* tslint:enable */

    var datasources = datasourceSrv.getMetricSources().filter(item => {
      return item.meta.builtIn === false;
    });

    this.hasDatasources = datasources.length > 0;
    this.checksDone = true;
  }

  dismiss() {
    this.row.removePanel(this.panel, false);

    this.backendSrv.request({
      method: 'PUT',
      url: '/api/user/helpflags/1',
      showSuccessAlert: false,
    }).then(res => {
      contextSrv.user.helpFlags1 = res.helpFlags1;
    });
  }
}

export {GettingStartedPanelCtrl, GettingStartedPanelCtrl as PanelCtrl}
