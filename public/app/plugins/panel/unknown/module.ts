import { PanelCtrl } from 'app/features/panel/panel_ctrl';

export class UnknownPanelCtrl extends PanelCtrl {
  static templateUrl = 'public/app/plugins/panel/unknown/module.html';

  /** @ngInject */
  constructor($scope, $injector) {
    super($scope, $injector);
  }
}
