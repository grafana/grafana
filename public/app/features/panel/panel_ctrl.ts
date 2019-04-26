import _ from 'lodash';
import Remarkable from 'remarkable';

import config from 'app/core/config';
import { profiler } from 'app/core/core';
import { Emitter } from 'app/core/core';
import getFactors from 'app/core/utils/factors';
import {
  duplicatePanel,
  removePanel,
  copyPanel as copyPanelUtil,
  editPanelJson as editPanelJsonUtil,
  sharePanel as sharePanelUtil,
} from 'app/features/dashboard/utils/panel';

import { GRID_COLUMN_COUNT, PANEL_HEADER_HEIGHT, PANEL_BORDER } from 'app/core/constants';

export class PanelCtrl {
  panel: any;
  error: any;
  dashboard: any;
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
  loading: boolean;
  timing: any;
  maxPanelsPerRowOptions: number[];

  constructor($scope, $injector) {
    this.$injector = $injector;
    this.$location = $injector.get('$location');
    this.$scope = $scope;
    this.$timeout = $injector.get('$timeout');
    this.editorTabs = [];
    this.events = this.panel.events;
    this.timing = {}; // not used but here to not break plugins

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
    profiler.renderingCompleted(this.panel.id);
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
    if (!this.editModeInitiated) {
      this.editModeInitiated = true;
      this.events.emit('init-edit-mode', null);
      this.maxPanelsPerRowOptions = getFactors(GRID_COLUMN_COUNT);
    }
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
      icon: 'gicon gicon-viewer',
      shortcut: 'v',
    });

    if (this.dashboard.meta.canEdit) {
      menu.push({
        text: 'Edit',
        click: 'ctrl.editPanel();',
        role: 'Editor',
        icon: 'gicon gicon-editor',
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

  calculatePanelHeight(containerHeight) {
    this.containerHeight = containerHeight;
    this.height = this.containerHeight - (PANEL_BORDER + PANEL_HEADER_HEIGHT);
  }

  render(payload?) {
    this.events.emit('render', payload);
  }

  duplicate() {
    duplicatePanel(this.dashboard, this.panel);
  }

  removePanel() {
    removePanel(this.dashboard, this.panel, true);
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
}
