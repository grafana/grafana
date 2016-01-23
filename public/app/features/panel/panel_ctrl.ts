///<reference path="../../headers/common.d.ts" />

import PanelMeta from './panel_meta2';

export class PanelCtrl {
  meta: any;
  panel: any;
  row: any;
  dashboard: any;

  constructor(private scope) {
    this.meta = new PanelMeta(this.panel);
    this.publishAppEvent('panel-instantiated', {scope: scope});
  }

  publishAppEvent(evtName, evt) {
    this.scope.$root.appEvent(evtName, evt);
  }

  changeView(fullscreen, edit) {
    this.publishAppEvent('panel-change-view', {
      fullscreen: fullscreen, edit: edit, panelId: this.panel.id
    });
  }

  viewPanel() {
    this.changeView(true, false);
  }

  editPanel() {
    this.changeView(true, true);
  }

  exitFullscreen() {
    this.changeView(false, false);
  }
}


