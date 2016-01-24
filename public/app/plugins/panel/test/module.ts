///<reference path="../../../headers/common.d.ts" />

import {PanelDirective, MetricsPanelCtrl} from '../../../features/panel/panel';

function optionsTab() {
  return {template: '<h2>options!</h2>' };
}

export class TestPanelCtrl extends MetricsPanelCtrl {
  constructor($scope) {
    super($scope);
  }

  initEditorTabs() {
    super.initEditorTabs();
    this.editorTabs.push({title: 'Options', directiveFn: optionsTab});
  }
}

class TestPanel extends PanelDirective {
  templateUrl = `app/plugins/panel/test/module.html`;
  controller = TestPanelCtrl;
}

export {TestPanel as Panel}
