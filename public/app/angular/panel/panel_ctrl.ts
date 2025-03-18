import { auto } from 'angular';
import { isString } from 'lodash';

import {
  AppEvent,
  PanelEvents,
  PanelPluginMeta,
  AngularPanelMenuItem,
  EventBusExtended,
  EventBusSrv,
} from '@grafana/data';
import { AngularLocationWrapper } from 'app/angular/AngularLocationWrapper';
import config from 'app/core/config';
import { profiler } from 'app/core/core';

import { DashboardModel } from '../../features/dashboard/state/DashboardModel';

export class PanelCtrl {
  panel: any;
  error: any;
  declare dashboard: DashboardModel;
  pluginName = '';
  pluginId = '';
  editorTabs: any;
  $scope: any;
  $injector: auto.IInjectorService;
  $timeout: any;
  editModeInitiated = false;
  declare height: number;
  declare width: number;
  containerHeight: any;
  events: EventBusExtended;
  loading = false;
  timing: any;
  $location: AngularLocationWrapper;

  constructor($scope: any, $injector: auto.IInjectorService) {
    this.panel = this.panel ?? $scope.$parent.panel;
    this.dashboard = this.dashboard ?? $scope.$parent.dashboard;
    this.$injector = $injector;
    this.$scope = $scope;
    this.$timeout = $injector.get('$timeout');
    this.editorTabs = [];
    this.$location = new AngularLocationWrapper();
    this.events = new EventBusSrv();
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
    this.events.emit(PanelEvents.initialized);
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

  initEditMode() {
    if (!this.editModeInitiated) {
      this.editModeInitiated = true;
      this.events.emit(PanelEvents.editModeInitialized);
    }
  }

  addEditorTab(title: string, directiveFn: any, index?: number, icon?: any) {
    const editorTab = { title, directiveFn, icon };

    if (isString(directiveFn)) {
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

  getExtendedMenu() {
    const menu: AngularPanelMenuItem[] = [];
    this.events.emit(PanelEvents.initPanelActions, menu);
    return menu;
  }

  // Override in sub-class to add items before extended menu
  async getAdditionalMenuItems(): Promise<any[]> {
    return [];
  }

  otherPanelInFullscreenMode() {
    return this.dashboard.otherPanelInFullscreen(this.panel);
  }

  render(payload?: any) {
    this.events.emit(PanelEvents.render, payload);
  }

  // overriden from react
  onPluginTypeChange = (plugin: PanelPluginMeta) => {};
}
