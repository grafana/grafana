///<reference path="../../../headers/common.d.ts" />

import {PanelDirective, PanelCtrl} from '../../../features/panel/panel';

function optionsTab() {
  return {
    template: '<h2>options!</h2>'
  };
}

export class TestPanelCtrl extends PanelCtrl {
  constructor($scope) {
    super($scope);
  }

  getEditorTabs() {
    return [{title: 'Options', directiveFn: optionsTab}];
  }
}

class TestPanel extends PanelDirective {
  templateUrl = `app/plugins/panel/test/module.html`;
  controller = TestPanelCtrl;
}

export {TestPanel as Panel}
