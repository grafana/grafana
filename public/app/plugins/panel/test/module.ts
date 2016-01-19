///<reference path="../../../headers/common.d.ts" />

import PanelMeta from 'app/features/panel/panel_meta2';

class PanelBaseCtrl {
  constructor(private $scope) {
    $scope.panelMeta = new PanelMeta({
      panelName: 'Table',
      editIcon:  "fa fa-table",
      fullscreen: true,
      metricsEditor: true,
    });
    $scope.testProp = "hello";
  }
}

class TestPanelCtrl extends PanelBaseCtrl {

  constructor($scope) {
    super($scope);
    $scope.panelMeta.panelName = "Test";
  }
}

function testPanelDirective() {
  return {
    restrict: 'E',
    template: `
    <grafana-panel>
      <div class="text-center" style="padding-top: 2rem">
        <h2>Test Panel, {{testProp}}</h2>
      </div>
    </grafana-panel>
    `,
    controller: TestPanelCtrl
  };
}

export {
  PanelBaseCtrl,
  TestPanelCtrl,
  testPanelDirective as panel
}
