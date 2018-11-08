import config from 'app/core/config';
import _ from 'lodash';
import $ from 'jquery';
import { profiler } from 'app/core/core';
import {
  duplicatePanel,
  copyPanel as copyPanelUtil,
  editPanelJson as editPanelJsonUtil,
  sharePanel as sharePanelUtil,
} from 'app/features/dashboard/utils/panel';
import Remarkable from 'remarkable';
import { GRID_CELL_HEIGHT, GRID_CELL_VMARGIN } from 'app/core/constants';

const TITLE_HEIGHT = 27;
const PANEL_BORDER = 2;

import { Emitter } from 'app/core/core';

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
  $location: any;
  $timeout: any;
  inspector: any;
  editModeInitiated: boolean;
  height: any;
  containerHeight: any;
  events: Emitter;
  timing: any;
  loading: boolean;

  constructor($scope, $injector) {
    this.$injector = $injector;
    this.$location = $injector.get('$location');
    this.$scope = $scope;
    this.$timeout = $injector.get('$timeout');
    this.editorTabIndex = 0;
    this.events = this.panel.events;
    this.timing = {};

    const plugin = config.panels[this.panel.type];
    if (plugin) {
      this.pluginId = plugin.id;
      this.pluginName = plugin.name;
    }

    $scope.$on('component-did-mount', () => this.panelDidMount());
  }

  panelDidMount() {
    this.events.emit('component-did-mount');
    this.dashboard.panelInitialized(this.panel);
  }

  renderingCompleted() {
    profiler.renderingCompleted(this.panel.id, this.timing);
  }

  refresh() {
    this.panel.refresh();
  }

  publishAppEvent(evtName, evt) {
    this.$scope.$root.appEvent(evtName, evt);
  }

  changeView(fullscreen, edit) {
    this.publishAppEvent('panel-change-view', {
      fullscreen: fullscreen,
      edit: edit,
      panelId: this.panel.id,
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

    const urlTab = (this.$injector.get('$routeParams').tab || '').toLowerCase();
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
    const route = this.$injector.get('$route');
    route.current.params.tab = this.editorTabs[newIndex].title.toLowerCase();
    route.updateParams();
  }

  addEditorTab(title, directiveFn, index?, icon?) {
    const editorTab = { title, directiveFn, icon };

    if (_.isString(directiveFn)) {
      editorTab.directiveFn = () => {
        return { templateUrl: directiveFn };
      };
    }

    if (index) {
      this.editorTabs.splice(index, 0, editorTab);
    } else {
      this.editorTabs.push(editorTab);
    }
  }

  getMenu() {
    const menu = [];
    menu.push({
      text: 'View',
      click: 'ctrl.viewPanel();',
      icon: 'fa fa-fw fa-eye',
      shortcut: 'v',
    });

    if (this.dashboard.meta.canEdit) {
      menu.push({
        text: 'Edit',
        click: 'ctrl.editPanel();',
        role: 'Editor',
        icon: 'fa fa-fw fa-edit',
        shortcut: 'e',
      });
    }

    menu.push({
      text: 'Share',
      click: 'ctrl.sharePanel();',
      icon: 'fa fa-fw fa-share',
      shortcut: 'p s',
    });

    // Additional items from sub-class
    menu.push(...this.getAdditionalMenuItems());

    const extendedMenu = this.getExtendedMenu();
    menu.push({
      text: 'More ...',
      click: '',
      icon: 'fa fa-fw fa-cube',
      submenu: extendedMenu,
    });

    if (this.dashboard.meta.canEdit) {
      menu.push({ divider: true, role: 'Editor' });
      menu.push({
        text: 'Remove',
        click: 'ctrl.removePanel();',
        role: 'Editor',
        icon: 'fa fa-fw fa-trash',
        shortcut: 'p r',
      });
    }

    return menu;
  }

  getExtendedMenu() {
    const menu = [];
    if (!this.panel.fullscreen && this.dashboard.meta.canEdit) {
      menu.push({
        text: 'Duplicate',
        click: 'ctrl.duplicate()',
        role: 'Editor',
        shortcut: 'p d',
      });

      menu.push({
        text: 'Copy',
        click: 'ctrl.copyPanel()',
        role: 'Editor',
      });
    }

    menu.push({
      text: 'Panel JSON',
      click: 'ctrl.editPanelJson(); dismiss();',
    });

    this.events.emit('init-panel-actions', menu);
    return menu;
  }

  // Override in sub-class to add items before extended menu
  getAdditionalMenuItems() {
    return [];
  }

  otherPanelInFullscreenMode() {
    return this.dashboard.meta.fullscreen && !this.panel.fullscreen;
  }

  calculatePanelHeight() {
    if (this.panel.fullscreen) {
      const docHeight = $('.react-grid-layout').height();
      const editHeight = Math.floor(docHeight * 0.35);
      const fullscreenHeight = Math.floor(docHeight * 0.8);
      this.containerHeight = this.panel.isEditing ? editHeight : fullscreenHeight;
    } else {
      this.containerHeight = this.panel.gridPos.h * GRID_CELL_HEIGHT + (this.panel.gridPos.h - 1) * GRID_CELL_VMARGIN;
    }

    if (this.panel.soloMode) {
      this.containerHeight = $(window).height();
    }

    // hacky solution
    if (this.panel.isEditing && !this.editModeInitiated) {
      this.initEditMode();
    }

    this.height = this.containerHeight - (PANEL_BORDER + TITLE_HEIGHT);
  }

  render(payload?) {
    this.timing.renderStart = new Date().getTime();
    this.events.emit('render', payload);
  }

  duplicate() {
    duplicatePanel(this.dashboard, this.panel);
  }

  removePanel() {
    this.publishAppEvent('panel-remove', {
      panelId: this.panel.id,
    });
  }

  editPanelJson() {
    editPanelJsonUtil(this.dashboard, this.panel);
  }

  copyPanel() {
    copyPanelUtil(this.panel);
  }

  sharePanel() {
    sharePanelUtil(this.dashboard, this.panel);
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
    let markdown = this.panel.description;

    if (options.mode === 'tooltip') {
      markdown = this.error || this.panel.description;
    }

    const linkSrv = this.$injector.get('linkSrv');
    const sanitize = this.$injector.get('$sanitize');
    const templateSrv = this.$injector.get('templateSrv');
    const interpolatedMarkdown = templateSrv.replace(markdown, this.panel.scopedVars);
    let html = '<div class="markdown-html">';

    html += new Remarkable().render(interpolatedMarkdown);

    if (this.panel.links && this.panel.links.length > 0) {
      html += '<ul>';
      for (const link of this.panel.links) {
        const info = linkSrv.getPanelLinkAnchorInfo(link, this.panel.scopedVars);
        html +=
          '<li><a class="panel-menu-link" href="' +
          info.href +
          '" target="' +
          info.target +
          '">' +
          info.title +
          '</a></li>';
      }
      html += '</ul>';
    }

    html += '</div>';
    return sanitize(html);
  }

  openInspector() {
    const modalScope = this.$scope.$new();
    modalScope.panel = this.panel;
    modalScope.dashboard = this.dashboard;
    modalScope.panelInfoHtml = this.getInfoContent({ mode: 'inspector' });

    modalScope.inspector = $.extend(true, {}, this.inspector);
    this.publishAppEvent('show-modal', {
      src: 'public/app/features/dashboard/partials/inspector.html',
      scope: modalScope,
    });
  }
}
