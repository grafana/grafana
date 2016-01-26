///<reference path="../../headers/common.d.ts" />

import config from 'app/core/config';

export class PanelCtrl {
  panel: any;
  row: any;
  dashboard: any;
  editorTabIndex: number;
  pluginName: string;
  pluginId: string;
  icon: string;
  editorTabs: any;
  $scope: any;
  $injector: any;
  fullscreen: boolean;
  inspector: any;
  editModeInitiated: boolean;
  editorHelpIndex: number;

  constructor($scope, $injector) {
    var plugin = config.panels[this.panel.type];

    this.$injector = $injector;
    this.$scope = $scope;
    this.pluginName = plugin.name;
    this.pluginId = plugin.id;
    this.icon = plugin.info.icon;
    this.editorTabIndex = 0;

    $scope.$on("refresh", () => this.refresh());
  }

  init() {
    this.publishAppEvent('panel-instantiated', {scope: this.$scope});
    this.refresh();
  }

  renderingCompleted() {
    this.$scope.$root.performance.panelsRendered++;
  }

  refresh() {
    return;
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
    if (!this.editModeInitiated) {
      this.editorTabs = [];
      this.addEditorTab('General', 'public/app/partials/panelgeneral.html');
      this.initEditMode();
    }

    this.changeView(true, true);
  }

  exitFullscreen() {
    this.changeView(false, false);
  }

  initEditMode() {
    return;
  }

  addEditorTab(title, templateUrl) {
    this.editorTabs.push({
      title: title,
      directiveFn: function() {
        return {templateUrl: templateUrl};
      }
    });
  }

  getMenu() {
    let menu = [];
    menu.push({text: 'View', click: 'ctrl.viewPanel(); dismiss();'});
    menu.push({text: 'Edit', click: 'ctrl.editPanel(); dismiss();', role: 'Editor'});
    menu.push({text: 'Duplicate', click: 'ctrl.duplicate()', role: 'Editor' });
    menu.push({text: 'Share', click: 'ctrl.share(); dismiss();'});
    return menu;
  }

  otherPanelInFullscreenMode() {
    return this.dashboard.meta.fullscreen && !this.fullscreen;
  }

  broadcastRender(arg1?, arg2?) {
    this.$scope.$broadcast('render', arg1, arg2);
  }

 toggleEditorHelp(index) {
   if (this.editorHelpIndex === index) {
     this.editorHelpIndex = null;
     return;
   }
   this.editorHelpIndex = index;
 }

}
