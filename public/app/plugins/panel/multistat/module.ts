import { MetricsPanelCtrl } from 'app/plugins/sdk';

class MultiStatCtrl extends MetricsPanelCtrl {
  static templateUrl = 'module.html';

  /** @ngInject */
  constructor($scope, $injector) {
    super($scope, $injector);
  }
}

export { MultiStatCtrl, MultiStatCtrl as PanelCtrl };
