///<reference path="../../headers/common.d.ts" />

import config from 'app/core/config';

function generalOptionsTabEditorTab() {
  return {templateUrl: 'public/app/partials/panelgeneral.html'};
}

export class PanelCtrl {
  panel: any;
  row: any;
  dashboard: any;
  editorTabIndex: number;
  name: string;
  icon: string;
  editorTabs: any;
  $scope: any;
  isMetricsPanel: boolean;

  constructor($scope) {
    var plugin = config.panels[this.panel.type];

    this.$scope = $scope;
    this.name = plugin.name;
    this.icon = plugin.info.icon;
    this.editorTabIndex = 0;
    this.publishAppEvent('panel-instantiated', {scope: $scope});
  }

  publishAppEvent(evtName, evt) {
    this.$scope.$root.appEvent(evtName, evt);
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
    if (!this.editorTabs) {
      this.initEditorTabs();
    }

    this.changeView(true, true);
  }

  exitFullscreen() {
    this.changeView(false, false);
  }

  initEditorTabs() {
    this.editorTabs = [];
    this.editorTabs.push({title: 'General', directiveFn: generalOptionsTabEditorTab});
  }

  getMenu() {
    let menu = [];
    menu.push({text: 'View', click: 'ctrl.viewPanel(); dismiss();'});
    menu.push({text: 'Edit', click: 'ctrl.editPanel(); dismiss();', role: 'Editor'});
    menu.push({text: 'Duplicate', click: 'ctrl.duplicate()', role: 'Editor' });
    menu.push({text: 'Share', click: 'ctrl.share(); dismiss();'});
    return menu;
  }
}
