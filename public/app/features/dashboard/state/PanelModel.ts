// Libraries
import _ from 'lodash';

// Utils
import { Emitter } from 'app/core/utils/emitter';
import { getNextRefIdChar } from 'app/core/utils/query';

// Types
import { DataQuery, ScopedVars, DataQueryResponseData, PanelPlugin, DataLink } from '@grafana/ui';
import config from 'app/core/config';

import { PanelQueryRunner } from './PanelQueryRunner';

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
};

const defaults: any = {
  gridPos: { x: 0, y: 0, h: 3, w: 6 },
  datasource: null,
  targets: [{ refId: 'A' }],
  cachedPluginOptions: {},
  transparent: false,
};

export class PanelModel {
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
  private queryRunner?: PanelQueryRunner;

  constructor(model: any) {
    this.events = new Emitter();

    // copy properties from persisted model
    for (const property in model) {
      (this as any)[property] = model[property];
    }

    // defaults
    _.defaultsDeep(this, _.cloneDeep(defaults));

    // queries must have refId
    this.ensureQueryIds();
    this.restoreInfintyForThresholds();
  }

  ensureQueryIds() {
    if (this.targets && _.isArray(this.targets)) {
      for (const query of this.targets) {
        if (!query.refId) {
          query.refId = getNextRefIdChar(this.targets);
        }
      }
    }
  }

  restoreInfintyForThresholds() {
    if (this.options && this.options.fieldOptions) {
      for (const threshold of this.options.fieldOptions.thresholds) {
        if (threshold.value === null) {
          threshold.value = -Infinity;
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
    this.events.emit('view-mode-changed');
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
      this.events.emit('panel-size-changed');
    }
  }

  resizeDone() {
    this.events.emit('panel-size-changed');
  }

  refresh() {
    this.hasRefreshed = true;
    this.events.emit('refresh');
  }

  render() {
    if (!this.hasRefreshed) {
      this.refresh();
    } else {
      this.events.emit('render');
    }
  }

  initialized() {
    this.events.emit('panel-initialized');
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
    this.options = _.defaultsDeep({}, this.options || {}, plugin.defaults);
  }

  pluginLoaded(plugin: PanelPlugin) {
    this.plugin = plugin;

    this.applyPluginOptionDefaults(plugin);

    if (plugin.panel && plugin.onPanelMigration) {
      const version = getPluginVersion(plugin);
      if (version !== this.pluginVersion) {
        this.options = plugin.onPanelMigration(this);
        this.pluginVersion = version;
      }
    }
  }

  changePlugin(newPlugin: PanelPlugin) {
    const pluginId = newPlugin.meta.id;
    const oldOptions: any = this.getOptionsToRemember();
    const oldPluginId = this.type;

    // for angular panels we must remove all events and let angular panels do some cleanup
    if (this.plugin.angularPanelCtrl) {
      this.destroy();
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

    // switch
    this.type = pluginId;
    this.plugin = newPlugin;
    this.applyPluginOptionDefaults(newPlugin);
    // Let panel plugins inspect options from previous panel and keep any that it can use
    if (newPlugin.onPanelTypeChanged) {
      this.options = this.options || {};
      const old = oldOptions && oldOptions.options ? oldOptions.options : {};
      Object.assign(this.options, newPlugin.onPanelTypeChanged(this.options, oldPluginId, old));
    }

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

  getQueryRunner(): PanelQueryRunner {
    if (!this.queryRunner) {
      this.queryRunner = new PanelQueryRunner();
    }
    return this.queryRunner;
  }

  hasTitle() {
    return this.title && this.title.length > 0;
  }

  destroy() {
    this.events.emit('panel-teardown');
    this.events.removeAllListeners();

    if (this.queryRunner) {
      this.queryRunner.destroy();
      this.queryRunner = null;
    }
  }
}

function getPluginVersion(plugin: PanelPlugin): string {
  return plugin && plugin.meta.info.version ? plugin.meta.info.version : config.buildInfo.version;
}
