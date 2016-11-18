///<reference path="../../../headers/common.d.ts" />

import {PanelCtrl} from 'app/plugins/sdk';

import {contextSrv} from 'app/core/core';

class GettingStartedPanelCtrl extends PanelCtrl {
  static templateUrl = 'public/app/plugins/panel/gettingstarted/module.html';
  checksDone: boolean;
  step: number;

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

    this.step = 2;
    if (datasources.length === 0) {
      this.checksDone = true;
      return;
    }

    this.step = 3;
    this.backendSrv.search({limit: 1}).then(result => {
      if (result.length === 0) {
        this.checksDone = true;
        return;
      }

      this.step = 4;
      this.checksDone = true;
    });
  }

  getStateClass(step) {
    if (step === this.step) { return 'active'; }
    if (step < this.step) { return 'completed'; }
    return '';
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
