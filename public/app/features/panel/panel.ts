///<reference path="../../headers/common.d.ts" />

import config from 'app/core/config';

import {PanelCtrl} from './panel_ctrl';
import {MetricsPanelCtrl} from './metrics_panel_ctrl';
import {QueryCtrl} from './query_ctrl';

class DefaultPanelCtrl extends PanelCtrl {
  /** @ngInject */
  constructor($scope, $injector) {
    super($scope, $injector);
  }
}

export {
  PanelCtrl,
  DefaultPanelCtrl,
  MetricsPanelCtrl,
  QueryCtrl,
}
