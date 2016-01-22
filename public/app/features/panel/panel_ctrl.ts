///<reference path="../../headers/common.d.ts" />

import PanelMeta from './panel_meta2';

export class PanelCtrl {
  panelMeta: any;
  panel: any;
  row: any;
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


