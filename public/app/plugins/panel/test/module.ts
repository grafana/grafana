///<reference path="../../../headers/common.d.ts" />

import {PanelCtrl} from '../../../features/panel/panel_ctrl';

class TestPanelCtrl extends PanelCtrl {
  constructor($scope) {
    super($scope);
  }
}

var panel = {
  templateUrl: `app/plugins/panel/test/module.html`,
  controller: TestPanelCtrl,
  link: function(scope, elem) {
    console.log('panel link');
  }
};

export {
  TestPanelCtrl,
  panel,
}
