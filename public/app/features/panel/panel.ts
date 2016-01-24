///<reference path="../../headers/common.d.ts" />

import PanelMeta from './panel_meta3';

export class PanelCtrl {
  meta: any;
  panel: any;
  row: any;
  dashboard: any;
  tabIndex: number;

  constructor(private scope) {
    this.meta = new PanelMeta(this.panel);
    this.tabIndex = 0;
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

export class PanelDirective {
  template: string;
  templateUrl: string;
  bindToController: boolean;
  scope: any;
  controller: any;
  controllerAs: string;

  getDirective() {
    return {
      template: this.template,
      templateUrl: this.templateUrl,
      controller: this.controller,
      controllerAs: 'ctrl',
      bindToController: true,
      scope: {dashboard: "=", panel: "=", row: "="},
      link: this.link
    };
  }

  link(scope) {
    return null;
  }
}

