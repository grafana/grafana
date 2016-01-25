///<reference path="../../../headers/common.d.ts" />

import {PanelDirective, MetricsPanelCtrl} from '../../../features/panel/panel';

function optionsTab() {
  return {template: '<h2>options!</h2>' };
}

export class TestPanelCtrl extends MetricsPanelCtrl {
  data: any;

  constructor($scope, $injector) {
    super($scope, $injector);
  }

  initEditorTabs() {
    super.initEditorTabs();
  }

  refreshData(data) {
    console.log('refreshData: ', data);
  }
}

class TestPanel extends PanelDirective {
  templateUrl = `app/plugins/panel/test/module.html`;
  controller = TestPanelCtrl;

  link(scope, elem) {
    console.log('test panel linking:', scope);
  }
}

export {TestPanel as Panel}
