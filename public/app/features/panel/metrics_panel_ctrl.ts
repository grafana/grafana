///<reference path="../../headers/common.d.ts" />

import config from 'app/core/config';
import {PanelCtrl} from './panel_ctrl';

function metricsEditorTab() {
  return {templateUrl: 'public/app/partials/metrics.html'};
}

class MetricsPanelCtrl extends PanelCtrl {
  constructor($scope) {
    super($scope);
  }

  initEditorTabs() {
    super.initEditorTabs();
    this.editorTabs.push({title: 'Metrics', directiveFn: metricsEditorTab});
  }
}

export {MetricsPanelCtrl};

