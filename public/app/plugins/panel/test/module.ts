///<reference path="../../../headers/common.d.ts" />

import PanelMeta from 'app/features/panel/panel_meta2';

class PanelBaseCtrl {
  panelMeta: any;
  panel: any;
  dashboard: any;

  constructor(private $scope) {
    this.panelMeta = new PanelMeta({
      panelName: 'Table',
      editIcon:  "fa fa-table",
      fullscreen: true,
      metricsEditor: true,
    });
  }
}

class TestPanelCtrl extends PanelBaseCtrl {

  constructor($scope) {
    super($scope);
  }
}

var testPanelComponent = {
  template: `
    <grafana-panel ctrl="ctrl">
      <div class="text-center" style="padding-top: 2rem">
        <h2>Test Panel</h2>
      </div>
    </grafana-panel>
    `,
  controller: TestPanelCtrl,
  controllerAs: 'ctrl',
  bindings: {
    dashboard: "=",
    panel: "=",
  }
};

export {
  PanelBaseCtrl,
  TestPanelCtrl,
  testPanelComponent as component,
}
