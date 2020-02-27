// Libraries
import _ from 'lodash';
// Utils
import { Emitter } from 'app/core/utils/emitter';
import { getNextRefIdChar } from 'app/core/utils/query';
// Types
import {
  DataQuery,
  DataQueryResponseData,
  PanelPlugin,
  PanelEvents,
  DataLink,
  DataTransformerConfig,
  ScopedVars,
} from '@grafana/data';
import { AngularComponent } from '@grafana/runtime';
import { EDIT_PANEL_ID } from 'app/core/constants';

import config from 'app/core/config';

import { PanelQueryRunner } from './PanelQueryRunner';
import { eventFactory } from '@grafana/data';
import { take } from 'rxjs/operators';

export const panelAdded = eventFactory<PanelModel | undefined>('panel-added');
export const panelRemoved = eventFactory<PanelModel | undefined>('panel-removed');
export const angularPanelUpdated = eventFactory('panel-angular-panel-updated');

export interface GridPos {
  x: number;
  y: number;
  w: number;
  h: number;
  static?: boolean;
}

const notPersistedProperties: { [str: string]: boolean } = {
  events: true,
  fullscreen: true,
  isEditing: true,
  isInView: true,
  hasRefreshed: true,
  cachedPluginOptions: true,
  plugin: true,
  queryRunner: true,
  angularPanel: true,
  restoreModel: true,
};

// For angular panels we need to clean up properties when changing type
// To make sure the change happens without strange bugs happening when panels use same
// named property with different type / value expectations
// This is not required for react panels
const mustKeepProps: { [str: string]: boolean } = {
  id: true,
  gridPos: true,
  type: true,
  title: true,
  scopedVars: true,
  repeat: true,
  repeatIteration: true,
  repeatPanelId: true,
  repeatDirection: true,
  repeatedByRow: true,
  minSpan: true,
  collapsed: true,
  panels: true,
  targets: true,
  datasource: true,
  timeFrom: true,
  timeShift: true,
  hideTimeOverride: true,
  description: true,
  links: true,
  fullscreen: true,
  isEditing: true,
  hasRefreshed: true,
  events: true,
  cacheTimeout: true,
  cachedPluginOptions: true,
  transparent: true,
  pluginVersion: true,
  queryRunner: true,
  transformations: true,
};

const defaults: any = {
  gridPos: { x: 0, y: 0, h: 3, w: 6 },
  targets: [{ refId: 'A' }],
  cachedPluginOptions: {},
  transparent: false,
  options: {},
};

export class PanelModel {
  /* persisted id, used in URL to identify a panel */
  id: number;
  gridPos: GridPos;
  type: string;
  title: string;
  alert?: any;
  scopedVars?: ScopedVars;
  repeat?: string;
  repeatIteration?: number;
  repeatPanelId?: number;
  repeatDirection?: string;
  repeatedByRow?: boolean;
  maxPerRow?: number;
  collapsed?: boolean;
  panels?: any;
  soloMode?: boolean;
  targets: DataQuery[];
  transformations?: DataTransformerConfig[];
  datasource: string;
  thresholds?: any;
  pluginVersion?: string;

  snapshotData?: DataQueryResponseData[];
  timeFrom?: any;
  timeShift?: any;
  hideTimeOverride?: any;
  options: {
    [key: string]: any;
  };

  maxDataPoints?: number;
  interval?: string;
  description?: string;
  links?: DataLink[];
  transparent: boolean;

  // non persisted
  fullscreen: boolean;
  isEditing: boolean;
  isInView: boolean;
  hasRefreshed: boolean;
  events: Emitter;
  cacheTimeout?: any;
  cachedPluginOptions?: any;
  legend?: { show: boolean };
  plugin?: PanelPlugin;
  angularPanel?: AngularComponent;

  private queryRunner?: PanelQueryRunner;

  constructor(model: any) {
    this.events = new Emitter();
    // should not be part of defaults as defaults are removed in save model and
    // this should not be removed in save model as exporter needs to templatize it
    this.datasource = null;
    this.restoreModel(model);
  }

  /** Given a persistened PanelModel restores property values */
  restoreModel = (model: any) => {
    // copy properties from persisted model
    for (const property in model) {
      (this as any)[property] = model[property];
    }

    // defaults
    _.defaultsDeep(this, _.cloneDeep(defaults));

    // queries must have refId
    this.ensureQueryIds();
  };

  ensureQueryIds() {
    if (this.targets && _.isArray(this.targets)) {
      for (const query of this.targets) {
        if (!query.refId) {
          query.refId = getNextRefIdChar(this.targets);
        }
      }
    }
  }

  getOptions() {
    return this.options;
  }

  updateOptions(options: object) {
    this.options = options;
    this.render();
  }

  getSaveModel() {
    const model: any = {};
    for (const property in this) {
      if (notPersistedProperties[property] || !this.hasOwnProperty(property)) {
        continue;
      }

      if (_.isEqual(this[property], defaults[property])) {
        continue;
      }

      model[property] = _.cloneDeep(this[property]);
    }
    return model;
  }

  setViewMode(fullscreen: boolean, isEditing: boolean) {
    this.fullscreen = fullscreen;
    this.isEditing = isEditing;
    this.events.emit(PanelEvents.viewModeChanged);
  }

  updateGridPos(newPos: GridPos) {
    let sizeChanged = false;

    if (this.gridPos.w !== newPos.w || this.gridPos.h !== newPos.h) {
      sizeChanged = true;
    }

    this.gridPos.x = newPos.x;
    this.gridPos.y = newPos.y;
    this.gridPos.w = newPos.w;
    this.gridPos.h = newPos.h;

    if (sizeChanged) {
      this.events.emit(PanelEvents.panelSizeChanged);
    }
  }

  resizeDone() {
    this.events.emit(PanelEvents.panelSizeChanged);
  }

  refresh() {
    this.hasRefreshed = true;
    this.events.emit(PanelEvents.refresh);
  }

  render() {
    if (!this.hasRefreshed) {
      this.refresh();
    } else {
      this.events.emit(PanelEvents.render);
    }
  }

  initialized() {
    this.events.emit(PanelEvents.panelInitialized);
  }

  private getOptionsToRemember() {
    return Object.keys(this).reduce((acc, property) => {
      if (notPersistedProperties[property] || mustKeepProps[property]) {
        return acc;
      }
      return {
        ...acc,
        [property]: (this as any)[property],
      };
    }, {});
  }

  private restorePanelOptions(pluginId: string) {
    const prevOptions = this.cachedPluginOptions[pluginId] || {};

    Object.keys(prevOptions).map(property => {
      (this as any)[property] = prevOptions[property];
    });
  }

  private applyPluginOptionDefaults(plugin: PanelPlugin) {
    if (plugin.angularConfigCtrl) {
      return;
    }
    this.options = _.mergeWith({}, plugin.defaults, this.options || {}, (objValue: any, srcValue: any): any => {
      if (_.isArray(srcValue)) {
        return srcValue;
      }
    });
  }

  pluginLoaded(plugin: PanelPlugin) {
    this.plugin = plugin;

    if (plugin.panel && plugin.onPanelMigration) {
      const version = getPluginVersion(plugin);

      if (version !== this.pluginVersion) {
        this.options = plugin.onPanelMigration(this);
        this.pluginVersion = version;
      }
    }

    this.applyPluginOptionDefaults(plugin);
  }

  changePlugin(newPlugin: PanelPlugin) {
    const pluginId = newPlugin.meta.id;
    const oldOptions: any = this.getOptionsToRemember();
    const oldPluginId = this.type;
    const wasAngular = !!this.plugin.angularPanelCtrl;

    if (this.angularPanel) {
      this.setAngularPanel(undefined);
    }

    // remove panel type specific  options
    for (const key of _.keys(this)) {
      if (mustKeepProps[key]) {
        continue;
      }

      delete (this as any)[key];
    }

    this.cachedPluginOptions[oldPluginId] = oldOptions;
    this.restorePanelOptions(pluginId);

    // Let panel plugins inspect options from previous panel and keep any that it can use
    if (newPlugin.onPanelTypeChanged) {
      let old: any = {};

      if (wasAngular) {
        old = { angular: oldOptions };
      } else if (oldOptions && oldOptions.options) {
        old = oldOptions.options;
      }
      this.options = this.options || {};
      Object.assign(this.options, newPlugin.onPanelTypeChanged(this.options, oldPluginId, old));
    }

    // switch
    this.type = pluginId;
    this.plugin = newPlugin;
    this.applyPluginOptionDefaults(newPlugin);

    if (newPlugin.onPanelMigration) {
      this.pluginVersion = getPluginVersion(newPlugin);
    }
  }

  addQuery(query?: Partial<DataQuery>) {
    query = query || { refId: 'A' };
    query.refId = getNextRefIdChar(this.targets);
    this.targets.push(query as DataQuery);
  }

  changeQuery(query: DataQuery, index: number) {
    // ensure refId is maintained
    query.refId = this.targets[index].refId;

    // update query in array
    this.targets = this.targets.map((item, itemIndex) => {
      if (itemIndex === index) {
        return query;
      }
      return item;
    });
  }

  getEditClone() {
    const sourceModel = this.getSaveModel();

    // Temporary id for the clone, restored later in redux action when changes are saved
    sourceModel.id = EDIT_PANEL_ID;

    const clone = new PanelModel(sourceModel);
    const sourceQueryRunner = this.getQueryRunner();

    // pipe last result to new clone query runner
    sourceQueryRunner
      .getData()
      .pipe(take(1))
      .subscribe(val => clone.getQueryRunner().pipeDataToSubject(val));

    return clone;
  }

  getQueryRunner(): PanelQueryRunner {
    if (!this.queryRunner) {
      this.queryRunner = new PanelQueryRunner();
      this.setTransformations(this.transformations);
    }
    return this.queryRunner;
  }

  hasTitle() {
    return this.title && this.title.length > 0;
  }

  isAngularPlugin(): boolean {
    return this.plugin && !!this.plugin.angularPanelCtrl;
  }

  destroy() {
    this.events.removeAllListeners();

    if (this.queryRunner) {
      this.queryRunner.destroy();
      this.queryRunner = null;
    }

    if (this.angularPanel) {
      this.angularPanel.destroy();
    }
  }

  setTransformations(transformations: DataTransformerConfig[]) {
    this.transformations = transformations;
    this.getQueryRunner().setTransformations(transformations);
  }

  setAngularPanel(component: AngularComponent) {
    if (this.angularPanel) {
      // this will remove all event listeners
      this.angularPanel.destroy();
    }

    this.angularPanel = component;
    this.events.emit(angularPanelUpdated);
  }
}

function getPluginVersion(plugin: PanelPlugin): string {
  return plugin && plugin.meta.info.version ? plugin.meta.info.version : config.buildInfo.version;
}
