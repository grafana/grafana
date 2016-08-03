class PanelMeta {
  description: any;
  fullscreen: any;
  editIcon: any;
  panelName: any;
  menu: any;
  editorTabs: any;
  extendedMenu: any;

  constructor(options : any) {
    this.description = options.description;
    this.fullscreen = options.fullscreen;
    this.editIcon = options.editIcon;
    this.panelName = options.panelName;
    this.menu = [];
    this.editorTabs = [];
    this.extendedMenu = [];

    if (options.fullscreen) {
      this.addMenuItem('查看', 'icon-eye-open', 'toggleFullscreen(false); dismiss();');
    }

    this.addMenuItem('编辑', 'icon-cog', 'editPanel(); dismiss();', 'Editor');
    this.addMenuItem('复制', 'icon-copy', 'duplicatePanel()', 'Editor');
    this.addMenuItem('分享', 'icon-share', 'sharePanel(); dismiss();');
    this.addMenuItem('分析', 'icon-share', 'decompose();','Editor');
    this.addEditorTab('概要', 'app/partials/panelgeneral.html');

    if (options.metricsEditor) {
      this.addEditorTab('指标', 'app/partials/metrics.html');
    }

    this.addExtendedMenuItem('查看JSON', '', 'editPanelJson(); dismiss();');
  }

  addMenuItem (text, icon, click, role?) {
    this.menu.push({text: text, icon: icon, click: click, role: role});
  }

  addExtendedMenuItem (text, icon, click, role?) {
    this.extendedMenu.push({text: text, icon: icon, click: click, role: role});
  }

  addEditorTab (title, src) {
    this.editorTabs.push({title: title, src: src});
  }
}

export = PanelMeta;
