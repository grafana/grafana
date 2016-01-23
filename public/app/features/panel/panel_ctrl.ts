///<reference path="../../headers/common.d.ts" />

import PanelMeta from './panel_meta2';

export class PanelCtrl {
  panelMeta: any;
  panel: any;
  row: any;
  dashboard: any;

  constructor(private scope) {
    this.panelMeta = new PanelMeta({
      panelName: 'Table',
      editIcon:  "fa fa-table",
      fullscreen: true,
      metricsEditor: true,
    });

    this.publishAppEvent('panel-instantiated', {scope: scope});
  }

  publishAppEvent(evtName, evt) {
    this.scope.$root.appEvent(evtName, evt);
  }

  editPanel() {
    this.publishAppEvent('panel-change-view', {
      fullscreen: true, edit: true, panelId: this.panel.id
    });
  }
}


