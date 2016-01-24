///<reference path="../../headers/common.d.ts" />

import config from 'app/core/config';

function panelOptionsTab() {
  return {templateUrl: 'app/partials/panelgeneral.html'};
}

export default class PanelMeta {
  description: any;
  icon: any;
  name: any;
  menu: any;
  editorTabs: any;
  extendedMenu: any;

  constructor(panel) {
    let panelInfo = config.panels[panel.type];
    console.log(panelInfo);

    this.icon = panelInfo.icon;
    this.name = panelInfo.name;
    this.menu = [];
    this.editorTabs = [];
    this.extendedMenu = [];

    if (panelInfo.fullscreen) {
      this.addMenuItem('View', 'icon-eye-open', 'ctrl.viewPanel(); dismiss();');
    }

    this.addMenuItem('Edit', 'icon-cog', 'ctrl.editPanel(); dismiss();', 'Editor');
    this.addMenuItem('Duplicate', 'icon-copy', 'ctrl.duplicate()', 'Editor');
    this.addMenuItem('Share', 'icon-share', 'ctrl.share(); dismiss();');

    this.addEditorTab('General', panelOptionsTab);

    if (panelInfo.metricsEditor) {
      this.addEditorTab('Metrics', 'app/partials/metrics.html');
    }

    this.addExtendedMenuItem('Panel JSON', '', 'ctrl.editPanelJson(); dismiss();');
  }

  addMenuItem (text, icon, click, role?) {
    this.menu.push({text: text, icon: icon, click: click, role: role});
  }

  addExtendedMenuItem (text, icon, click, role?) {
    this.extendedMenu.push({text: text, icon: icon, click: click, role: role});
  }

  addEditorTab(title, directiveFn) {
    this.editorTabs.push({title: title, directiveFn: directiveFn});
  }
}

