///<reference path="../../../headers/common.d.ts" />

import {PanelCtrl} from 'app/plugins/sdk';

class GettingstartedPanelCtrl extends PanelCtrl {
  static templateUrl = 'public/app/plugins/panel/gettingstarted/module.html';

  /** @ngInject */
  constructor($scope, $injector) {
    super($scope, $injector);
  }

}

export {GettingstartedPanelCtrl, GettingstartedPanelCtrl as PanelCtrl}
