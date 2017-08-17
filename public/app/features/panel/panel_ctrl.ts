///<reference path="../../headers/common.d.ts" />

import config from 'app/core/config';
import _ from 'lodash';
import angular from 'angular';
import $ from 'jquery';

const TITLE_HEIGHT = 25;
const EMPTY_TITLE_HEIGHT = 9;
const PANEL_PADDING = 5;

import {Emitter} from 'app/core/core';

export class PanelCtrl {
  panel: any;
  row: any;
  dashboard: any;
  editorTabIndex: number;
  pluginName: string;
  pluginId: string;
  editorTabs: any;
  $scope: any;
  $injector: any;
  $timeout: any;
  $_location: any;
  fullscreen: boolean;
  inspector: any;
  editModeInitiated: boolean;
  editorHelpIndex: number;
  editMode: any;
  height: any;
  containerHeight: any;
  events: Emitter;
  contextSrv: any;
  integrateSrv: any;

  constructor($scope, $injector) {
    this.$injector = $injector;
    this.$scope = $scope;
    this.$_location = $injector.get('$location');
    this.$timeout = $injector.get('$timeout');
    this.contextSrv = $injector.get('contextSrv');
    this.integrateSrv = $injector.get('integrateSrv');
    this.editorTabIndex = 0;
    this.events = new Emitter();

    var plugin = config.panels[this.panel.type];
    if (plugin) {
      this.pluginId = plugin.id;
      this.pluginName = plugin.name;
    }

    $scope.$on("refresh", () => this.refresh());
    $scope.$on("render", () => this.render());
    $scope.$on("$destroy", () => this.events.emit('panel-teardown'));
  }

  init() {
    this.calculatePanelHeight();
    this.publishAppEvent('panel-initialized', {scope: this.$scope});
    this.events.emit('panel-initialized');
  }

  renderingCompleted() {
    this.$scope.$root.performance.panelsRendered++;
  }

  refresh() {
    this.events.emit('refresh', null);
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
    this.addEditorTab('概要', 'public/app/partials/panelgeneral.html');
    this.editModeInitiated = true;
    this.events.emit('init-edit-mode', null);
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
    menu.push({text: '放大', click: 'ctrl.updateColumnSpan(1); dismiss();', role: 'Editor', icon: 'fa-plus', hover: 'hover-show pull-left'});
    menu.push({text: '缩小', click: 'ctrl.updateColumnSpan(-1); dismiss();', role: 'Editor',  icon: 'fa-minus', hover: 'hover-show pull-left'});
    menu.push({text: '删除', click: 'ctrl.removePanel(); dismiss();', role: 'Editor', icon: 'fa-trash-o', hover: 'hover-show  pull-left'});
    menu.push({text: '分享', click: 'ctrl.sharePanel(); dismiss();', role: 'Editor', icon: 'fa-external-link'});
    menu.push({text: '编辑', click: 'ctrl.editPanel(); dismiss();', role: 'Editor', icon: 'fa-pencil'});
    if (this.checkMenu('associate')) {
      menu.push({text: '关联性分析', click: 'ctrl.associateLink(); dismiss();', icon: 'fa-line-chart'});
    }
    if (this.checkMenu('integrate')) {
      menu.push({text: '整合分析', click: 'ctrl.toIntegrate(); dismiss();', icon: 'fa-book'});
    }
    return menu;
  }

  checkMenu(menu) {
    var pathname = window.location.pathname;
    var show = false;
    var isGraph = this.panel.type === 'graph';
    var isLine = this.panel.lines;
    switch (menu) {
      case 'associate':
        show = (/^\/anomaly/.test(pathname) || (/^\/integrate/.test(pathname)));
        break;
      case 'integrate':
        show = !(/^\/integrate/.test(pathname));
        break;
    }
    return show && isGraph && isLine;
  }

  getExtendedMenu() {
    var actions = [];
    if (!this.fullscreen) { //  duplication is not supported in fullscreen mode
      actions.push({ text: '复制', click: 'ctrl.duplicate(); dismiss();', role: 'Editor'});
    }
    actions.push({text: '查看', click: 'ctrl.viewPanel(); dismiss();', icon: 'icon-eye-open'});
    actions.push({text: '查看 JSON', click: 'ctrl.editPanelJson(); dismiss();', role: 'Editor'});
    this.events.emit('init-panel-actions', actions);
    return actions;
  }

  otherPanelInFullscreenMode() {
    return this.dashboard.meta.fullscreen && !this.fullscreen;
  }

  calculatePanelHeight() {
    if (this.fullscreen) {
      var docHeight = $(window).height();
      var editHeight = Math.floor(docHeight * 0.3);
      var fullscreenHeight = Math.floor(docHeight * 0.7);
      this.containerHeight = this.editMode ? editHeight : fullscreenHeight;
    } else {
      this.containerHeight = this.panel.height || this.row.height;
      if (_.isString(this.containerHeight)) {
        this.containerHeight = parseInt(this.containerHeight.replace('px', ''), 10);
      }
    }

    this.height = this.containerHeight - (PANEL_PADDING + (this.panel.title ? TITLE_HEIGHT : EMPTY_TITLE_HEIGHT));
  }

  render(payload?) {
    // ignore if other panel is in fullscreen mode
    if (this.otherPanelInFullscreenMode()) {
      return;
    }

    this.calculatePanelHeight();
    this.events.emit('render', payload);
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
      this.render();
    });
  }

  removePanel() {
    this.publishAppEvent('confirm-modal', {
      title: '移除面板',
      text: '您是否想移除这个面板？',
      icon: 'fa-trash',
      yesText: '删除',
      noText: '取消',
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

  associateLink() {
    try {
      var host = this.panel.targets[0].tags.host;
      var metric = this.panel.targets[0].metric;
      if (host && metric) {
        var link = '/alerts/association/' + host + '/100/' + this.contextSrv.user.orgId + '.' + this.contextSrv.user.systemId + '.' + metric;
       this.$_location.url(link);
      }
    } catch (err) {
      var reg = /\'(.*?)\'/g;
      var msg = "图表中缺少" + err.toString().match(reg)[0] + "配置";
      this.publishAppEvent('alert-warning', ['参数缺失', msg]);
    }
  }

  toIntegrate() {
    try{
      this.integrateSrv.options.targets = _.cloneDeep(this.panel.targets);
      this.integrateSrv.options.title = this.panel.title;
      if (!this.panel.targets[0].metric) {
        this.integrateSrv.options.targets[0].metric = "*";
      }
      if (!_.isNull(this.panel.targets[0].tags)) {
        this.integrateSrv.options.targets[0].tags = {host: "*"};
      }
      this.$_location.url('/integrate');
    }catch (e) {
      this.publishAppEvent('alert-warning', ['日志分析跳转失败', '可能缺少指标名']);
    }
  }
}
