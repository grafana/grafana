// TODO update
// class PanelMeta {
//   description: any;
//   fullscreen: any;
//   editIcon: any;
//   panelName: any;
//   menu: any;
//   editorTabs: any;
//   extendedMenu: any;
//
//   constructor(options : any) {
//     this.description = options.description;
//     this.fullscreen = options.fullscreen;
//     this.editIcon = options.editIcon;
//     this.panelName = options.panelName;
//     this.menu = [];
//     this.editorTabs = [];
//     this.extendedMenu = [];
//
//     this.addMenuItem('放大', 'fa-plus', 'updateColumnSpan(1); dismiss();', 'menuItemShow' , 'Editor');
//     this.addMenuItem('缩小', 'fa-minus', 'updateColumnSpan(-1); dismiss();', 'menuItemShow', 'Editor');
//     this.addMenuItem('删除', 'fa-trash-o', 'removePanel(panel); dismiss();', 'menuItemShow', 'Editor');
//     this.addMenuItem('分享', 'fa-external-link', 'sharePanel(); dismiss();', 'menuItemShow', 'Editor');
//     this.addMenuItem('信息', 'fa-question-circle', 'isShowInfo($event); dismiss();', 'menuItemShow && helpInfo.info');
//     this.addMenuItem('关联性分析', 'fa-line-chart', 'associateLink(); dismiss();', 'associateMenu');
//     this.addMenuItem('编辑', 'fa-pencil', 'editPanel(); dismiss();', 'true', 'Editor');
//     this.addMenuItem('整合分析', 'fa-book', 'toIntegrate();dismiss();', 'integrateMenu');
//
//     this.addExtendedMenuItem('复制', 'fa-files-o', 'duplicatePanel()', 'Editor');
//     if (options.fullscreen) {
//       this.addExtendedMenuItem('查看', 'icon-eye-open', 'toggleFullscreen(false);');
//     }
//     this.addEditorTab('概要', 'app/partials/panelgeneral.html');
//
//     if (options.metricsEditor) {
//       this.addEditorTab('指标', 'app/partials/metrics.html');
//     }
//
//     this.addExtendedMenuItem('查看JSON', '', 'editPanelJson();');
//   }
//
//   addMenuItem (text, icon, click, show, role?) {
//     this.menu.push({text: text, icon: icon, click: click, show: show, role: role});
//   }
//
//   addExtendedMenuItem (text, icon, click, role?) {
//     this.extendedMenu.push({text: text, icon: icon, click: click, role: role});
//   }
//
//   addEditorTab (title, src) {
//     this.editorTabs.push({title: title, src: src});
//   }
// }
//
// export = PanelMeta;
