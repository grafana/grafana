import _ from 'lodash';
import { sanitize, escapeHtml } from 'app/core/utils/text';

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
  calculateInnerPanelHeight,
} from 'app/features/dashboard/utils/panel';
import { GRID_COLUMN_COUNT } from 'app/core/constants';
import { auto } from 'angular';
import { TemplateSrv } from '../templating/template_srv';
import { getPanelLinksSupplier } from './panellinks/linkSuppliers';
import { renderMarkdown, AppEvent, PanelEvents, PanelPluginMeta } from '@grafana/data';
import { getLocationSrv } from '@grafana/runtime';

export class PanelCtrl {
  panel: any;
  error: any;
  dashboard: any;
  pluginName: string;
  pluginId: string;
  editorTabs: any;
  $scope: any;
  $injector: auto.IInjectorService;
  $location: any;
  $timeout: any;
  editModeInitiated: boolean;
  height: any;
  containerHeight: any;
  events: Emitter;
  loading: boolean;
  timing: any;
  maxPanelsPerRowOptions: number[];

  /** @ngInject */
  constructor($scope: any, $injector: auto.IInjectorService) {
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

    $scope.$on(PanelEvents.componentDidMount.name, () => this.panelDidMount());
  }

  panelDidMount() {
    this.events.emit(PanelEvents.componentDidMount);
    this.dashboard.panelInitialized(this.panel);
  }

  renderingCompleted() {
    profiler.renderingCompleted();
  }

  refresh() {
    this.panel.refresh();
  }

  publishAppEvent<T>(event: AppEvent<T>, payload?: T) {
    this.$scope.$root.appEvent(event, payload);
  }

  changeView(fullscreen: boolean, edit: boolean) {
    this.publishAppEvent(PanelEvents.panelChangeView, {
      fullscreen,
      edit,
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
      this.events.emit(PanelEvents.editModeInitialized);
      this.maxPanelsPerRowOptions = getFactors(GRID_COLUMN_COUNT);
    }
  }

  addEditorTab(title: string, directiveFn: any, index?: number, icon?: any) {
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

  async getMenu() {
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

    if (config.featureToggles.inspect) {
      menu.push({
        text: 'Inspect',
        icon: 'fa fa-fw fa-info-circle',
        click: 'ctrl.inspectPanel();',
        shortcut: 'p i',
      });
    }

    // Additional items from sub-class
    menu.push(...(await this.getAdditionalMenuItems()));

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

    this.events.emit(PanelEvents.initPanelActions, menu);
    return menu;
  }

  // Override in sub-class to add items before extended menu
  async getAdditionalMenuItems(): Promise<any[]> {
    return [];
  }

  otherPanelInFullscreenMode() {
    return this.dashboard.meta.fullscreen && !this.panel.fullscreen;
  }

  calculatePanelHeight(containerHeight: number) {
    this.containerHeight = containerHeight;
    this.height = calculateInnerPanelHeight(this.panel, containerHeight);
  }

  render(payload?: any) {
    this.events.emit(PanelEvents.render, payload);
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

  inspectPanel() {
    getLocationSrv().update({
      query: {
        inspect: this.panel.id,
      },
      partial: true,
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

  getInfoContent(options: { mode: string }) {
    const { panel } = this;
    let markdown = panel.description || '';

    if (options.mode === 'tooltip') {
      markdown = this.error || panel.description || '';
    }

    const templateSrv: TemplateSrv = this.$injector.get('templateSrv');
    const interpolatedMarkdown = templateSrv.replace(markdown, panel.scopedVars);
    let html = '<div class="markdown-html panel-info-content">';

    const md = renderMarkdown(interpolatedMarkdown);
    html += config.disableSanitizeHtml ? md : sanitize(md);

    if (panel.links && panel.links.length > 0) {
      const interpolatedLinks = getPanelLinksSupplier(panel).getLinks();

      html += '<ul class="panel-info-corner-links">';
      for (const link of interpolatedLinks) {
        html +=
          '<li><a class="panel-menu-link" href="' +
          escapeHtml(link.href) +
          '" target="' +
          escapeHtml(link.target) +
          '">' +
          escapeHtml(link.title) +
          '</a></li>';
      }
      html += '</ul>';
    }

    html += '</div>';

    return html;
  }

  // overriden from react
  onPluginTypeChange = (plugin: PanelPluginMeta) => {};
}
