///<reference path="../../../headers/common.d.ts" />

import {PanelDirective, PanelCtrl} from '../../../features/panel/panel';

class TestPanelCtrl extends PanelCtrl {
  constructor($scope) {
    super($scope);
  }
}


class TestPanel extends PanelDirective {
  templateUrl = `app/plugins/panel/test/module.html`;
  controller = TestPanelCtrl;
}

export {
  TestPanelCtrl,
  // testPanelDirective as panel,
  TestPanel as Panel,
}
