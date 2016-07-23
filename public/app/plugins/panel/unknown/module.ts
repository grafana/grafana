///<reference path="../../../headers/common.d.ts" />

import {PanelCtrl} from 'app/plugins/sdk';

export class UnknownPanelCtrl extends PanelCtrl {
  static templateUrl = 'public/app/plugins/panel/unknown/module.html';

  /** @ngInject */
  constructor($scope, $injector) {
    super($scope, $injector);
  }

}



