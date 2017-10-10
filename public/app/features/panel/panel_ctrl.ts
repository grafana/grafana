import config from 'app/core/config';
import _ from 'lodash';
import $ from 'jquery';
import {profiler} from 'app/core/profiler';
import Remarkable from 'remarkable';
import {CELL_HEIGHT, CELL_VMARGIN} from '../dashboard/model';

const TITLE_HEIGHT = 25;
const EMPTY_TITLE_HEIGHT = 9;
const PANEL_PADDING = 5;
const PANEL_BORDER = 2;

import {Emitter} from 'app/core/core';

export class PanelCtrl {
  panel: any;
  error: any;
  dashboard: any;
  editorTabIndex: number;
  pluginName: string;
  pluginId: string;
  editorTabs: any;
  $scope: any;
  $injector: any;
  $timeout: any;
  fullscreen: boolean;
  inspector: any;
  editModeInitiated: boolean;
  editMode: any;
  height: any;
  containerHeight: any;
  events: Emitter;
  timing: any;

  constructor($scope, $injector) {
    this.$injector = $injector;
    this.$scope = $scope;
    this.$timeout = $injector.get('$timeout');
    this.editorTabIndex = 0;
    this.events = this.panel.events;
    this.timing = {};

    var plugin = config.panels[this.panel.type];
    if (plugin) {
      this.pluginId = plugin.id;
      this.pluginName = plugin.name;
    }

    $scope.$on("refresh", () => this.refresh());
    $scope.$on("$destroy", () => {
      this.events.emit('panel-teardown');
      this.events.removeAllListeners();
    });
  }

  init() {
    this.events.on('panel-size-changed', this.onSizeChanged.bind(this));
    this.publishAppEvent('panel-initialized', {scope: this.$scope});
    this.events.emit('panel-initialized');
  }

  renderingCompleted() {
    profiler.renderingCompleted(this.panel.id, this.timing);
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
    this.addEditorTab('General', 'public/app/partials/panelgeneral.html');
    this.editModeInitiated = true;
    this.events.emit('init-edit-mode', null);

    var urlTab = (this.$injector.get('$routeParams').tab || '').toLowerCase();
    if (urlTab) {
      this.editorTabs.forEach((tab, i) => {
        if (tab.title.toLowerCase() === urlTab) {
          this.editorTabIndex = i;
        }
      });
    }
  }

  changeTab(newIndex) {
    this.editorTabIndex = newIndex;
    var route = this.$injector.get('$route');
    route.current.params.tab = this.editorTabs[newIndex].title.toLowerCase();
    route.updateParams();
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
    menu.push({text: 'View', click: 'ctrl.viewPanel();', icon: "fa fa-fw fa-eye", shortcut: "v"});
    menu.push({text: 'Edit', click: 'ctrl.editPanel();', role: 'Editor', icon: "fa fa-fw fa-edit", shortcut: "e"});
    menu.push({text: 'Share', click: 'ctrl.sharePanel();', icon: "fa fa-fw fa-share", shortcut: "p s"});

    if (!this.fullscreen) {
      menu.push({ text: 'Duplicate', click: 'ctrl.duplicate()', role: 'Editor', icon: "fa fa-fw fa-copy" });
    }

    menu.push({divider: true});
    let extendedMenu = this.getExtendedMenu();
    menu.push({text: 'More ...', click: 'ctrl.removePanel();', icon: "fa fa-fw fa-cube", submenu: extendedMenu});

    menu.push({divider: true, role: 'Editor'});
    menu.push({text: 'Remove', click: 'ctrl.removePanel();', role: 'Editor', icon: "fa fa-fw fa-trash", shortcut: "p r"});
    return menu;
  }

  getExtendedMenu() {
    var actions = [{text: 'Panel JSON', click: 'ctrl.editPanelJson(); dismiss();'}];
    this.events.emit('init-panel-actions', actions);
    return actions;
  }

  otherPanelInFullscreenMode() {
    return this.dashboard.meta.fullscreen && !this.fullscreen;
  }

  calculatePanelHeight() {
    if (this.fullscreen) {
       var docHeight = $(window).height();
       var editHeight = Math.floor(docHeight * 0.4);
       var fullscreenHeight = Math.floor(docHeight * 0.8);
       this.containerHeight = this.editMode ? editHeight : fullscreenHeight;
    } else {
      this.containerHeight = this.panel.gridPos.h * CELL_HEIGHT + ((this.panel.gridPos.h-1) * CELL_VMARGIN);
    }

    this.height = this.containerHeight - (PANEL_BORDER + PANEL_PADDING + (this.panel.title ? TITLE_HEIGHT : EMPTY_TITLE_HEIGHT));
  }

  render(payload?) {
    this.timing.renderStart = new Date().getTime();
    this.events.emit('render', payload);
  }

  private onSizeChanged() {
    this.calculatePanelHeight();
    this.$timeout(() => {
      this.render();
    });
  }

  duplicate() {
    this.dashboard.duplicatePanel(this.panel);
    this.$timeout(() => {
      this.$scope.$root.$broadcast('render');
    });
  }

  removePanel() {
    this.dashboard.removePanel(this.panel);
  }

  editPanelJson() {
    this.publishAppEvent('show-json-editor', {
      object: this.panel,
      updateHandler: this.replacePanel.bind(this)
    });
  }

  replacePanel(newPanel, oldPanel) {
    var index = _.indexOf(this.dashboard.panels, oldPanel);
    this.dashboard.panels.splice(index, 1);

    // adding it back needs to be done in next digest
    this.$timeout(() => {
      newPanel.id = oldPanel.id;
      newPanel.width = oldPanel.width;
      this.dashboard.panels.splice(index, 0, newPanel);
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

  getInfoMode() {
    if (this.error) {
      return 'error';
    }
    if (!!this.panel.description) {
      return 'info';
    }
    if (this.panel.links && this.panel.links.length) {
      return 'links';
    }
    return '';
  }

  getInfoContent(options) {
    var markdown = this.panel.description;

    if (options.mode === 'tooltip') {
      markdown = this.error || this.panel.description;
    }

    var linkSrv = this.$injector.get('linkSrv');
    var templateSrv = this.$injector.get('templateSrv');
    var interpolatedMarkdown = templateSrv.replace(markdown, this.panel.scopedVars);
    var html = '<div class="markdown-html">';

    html += new Remarkable().render(interpolatedMarkdown);

    if (this.panel.links && this.panel.links.length > 0) {
      html += '<ul>';
      for (let link of this.panel.links) {
        var info = linkSrv.getPanelLinkAnchorInfo(link, this.panel.scopedVars);
        html += '<li><a class="panel-menu-link" href="' + info.href + '" target="' + info.target + '">' + info.title + '</a></li>';
      }
      html += '</ul>';
    }

    return html + '</div>';
  }

  openInspector() {
    var modalScope = this.$scope.$new();
    modalScope.panel = this.panel;
    modalScope.dashboard = this.dashboard;
    modalScope.panelInfoHtml = this.getInfoContent({mode: 'inspector'});

    modalScope.inspector = $.extend(true, {}, this.inspector);
    this.publishAppEvent('show-modal', {
      src: 'public/app/features/dashboard/partials/inspector.html',
      scope: modalScope
    });
  }
}
