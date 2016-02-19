///<reference path="../../headers/common.d.ts" />

import config from 'app/core/config';
import _ from 'lodash';
import angular from 'angular';

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
  $timeout: any;
  fullscreen: boolean;
  inspector: any;
  editModeInitiated: boolean;
  editorHelpIndex: number;

  constructor($scope, $injector) {
    this.$injector = $injector;
    this.$scope = $scope;
    this.$timeout = $injector.get('$timeout');
    this.editorTabIndex = 0;

    var plugin = config.panels[this.panel.type];
    if (plugin) {
      this.pluginId = plugin.id;
      this.pluginName = plugin.name;
    }

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
    this.changeView(true, true);
  }

  exitFullscreen() {
    this.changeView(false, false);
  }

  initEditMode() {
    this.editorTabs = [];
    this.addEditorTab('General', 'public/app/partials/panelgeneral.html');
    this.editModeInitiated = true;
  }

  addEditorTab(title, directiveFn, index?) {
    var editorTab = {title, directiveFn};

    if (_.isString(directiveFn)) {
      editorTab.directiveFn = function() {
        return {templateUrl: directiveFn};
      };
    }
    if (index) {
      this.editorTabs.splice(index, 0, editorTab);
    } else {
      this.editorTabs.push(editorTab);
    }
  }

  getMenu() {
    let menu = [];
    menu.push({text: 'View', click: 'ctrl.viewPanel(); dismiss();'});
    menu.push({text: 'Edit', click: 'ctrl.editPanel(); dismiss();', role: 'Editor'});
    if (!this.fullscreen) { //  duplication is not supported in fullscreen mode
      menu.push({ text: 'Duplicate', click: 'ctrl.duplicate()', role: 'Editor' });
    }
    menu.push({text: 'Share', click: 'ctrl.sharePanel(); dismiss();'});
    return menu;
  }

  getExtendedMenu() {
    return [{text: 'Panel JSON', click: 'ctrl.editPanelJson(); dismiss();'}];
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

  duplicate() {
    this.dashboard.duplicatePanel(this.panel, this.row);
  }

  updateColumnSpan(span) {
    this.panel.span = Math.min(Math.max(Math.floor(this.panel.span + span), 1), 12);
    this.$timeout(() => {
      this.broadcastRender();
    });
  }

  removePanel() {
    this.publishAppEvent('confirm-modal', {
      title: 'Are you sure you want to remove this panel?',
      icon: 'fa-trash',
      yesText: 'Delete',
      onConfirm: () => {
        this.row.panels = _.without(this.row.panels, this.panel);
      }
    });
  }

  editPanelJson() {
    this.publishAppEvent('show-json-editor', {
      object: this.panel,
      updateHandler: this.replacePanel.bind(this)
    });
  }

  replacePanel(newPanel, oldPanel) {
    var row = this.row;
    var index = _.indexOf(this.row.panels, oldPanel);
    this.row.panels.splice(index, 1);

    // adding it back needs to be done in next digest
    this.$timeout(() => {
      newPanel.id = oldPanel.id;
      newPanel.span = oldPanel.span;
      this.row.panels.splice(index, 0, newPanel);
    });
  }

  sharePanel() {
    var shareScope = this.$scope.$new();
    shareScope.panel = this.panel;
    shareScope.dashboard = this.dashboard;

    this.publishAppEvent('show-modal', {
     src: 'public/app/features/dashboard/partials/shareModal.html',
     scope: shareScope
   });
  }

  openInspector() {
    var modalScope = this.$scope.$new();
    modalScope.panel = this.panel;
    modalScope.dashboard = this.dashboard;
    modalScope.inspector = angular.copy(this.inspector);

    this.publishAppEvent('show-modal', {
      src: 'public/app/partials/inspector.html',
      scope: modalScope
    });
  }
}
