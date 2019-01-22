// Libraries
import _ from 'lodash';

// Types
import { Emitter } from 'app/core/utils/emitter';
import { PANEL_OPTIONS_KEY_PREFIX } from 'app/core/constants';
import { DataQuery } from '@grafana/ui/src/types';

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
  hasRefreshed: true,
  cachedPluginOptions: true,
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
  maxDataPoints: true,
  interval: true,
  description: true,
  links: true,
  fullscreen: true,
  isEditing: true,
  hasRefreshed: true,
  events: true,
  cacheTimeout: true,
  cachedPluginOptions: true,
  transparent: true,
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
  scopedVars?: any;
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

  snapshotData?: any;
  timeFrom?: any;
  timeShift?: any;
  hideTimeOverride?: any;

  maxDataPoints?: number;
  interval?: string;
  description?: string;
  links?: [];
  transparent: boolean;

  // non persisted
  fullscreen: boolean;
  isEditing: boolean;
  hasRefreshed: boolean;
  events: Emitter;
  cacheTimeout?: any;

  // cache props between plugins
  cachedPluginOptions?: any;

  constructor(model) {
    this.events = new Emitter();

    // copy properties from persisted model
    for (const property in model) {
      this[property] = model[property];
    }

    // defaults
    _.defaultsDeep(this, _.cloneDeep(defaults));
    // queries must have refId
    this.ensureQueryIds();
  }

  ensureQueryIds() {
    if (this.targets) {
      for (const query of this.targets) {
        if (!query.refId) {
          query.refId = this.getNextQueryLetter();
        }
      }
    }
  }

  getOptions(panelDefaults) {
    return _.defaultsDeep(this[this.getOptionsKey()] || {}, panelDefaults);
  }

  updateOptions(options: object) {
    const update: any = {};
    update[this.getOptionsKey()] = options;
    Object.assign(this, update);
    this.render();
  }

  private getOptionsKey() {
    return PANEL_OPTIONS_KEY_PREFIX + this.type;
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
        [property]: this[property],
      };
    }, {});
  }

  private saveCurrentPanelOptions() {
    this.cachedPluginOptions[this.type] = this.getOptionsToRemember();
  }

  private restorePanelOptions(pluginId: string) {
    const prevOptions = this.cachedPluginOptions[pluginId] || {};

    Object.keys(prevOptions).map(property => {
      this[property] = prevOptions[property];
    });
  }

  changeType(pluginId: string, fromAngularPanel: boolean) {
    this.saveCurrentPanelOptions();
    this.type = pluginId;

    // for angular panels only we need to remove all events and let angular panels do some cleanup
    if (fromAngularPanel) {
      this.destroy();

      for (const key of _.keys(this)) {
        if (mustKeepProps[key]) {
          continue;
        }

        delete this[key];
      }
    }

    this.restorePanelOptions(pluginId);
  }

  addQuery(query?: Partial<DataQuery>) {
    query = query || { refId: 'A' };
    query.refId = this.getNextQueryLetter();
    this.targets.push(query as DataQuery);
  }

  getNextQueryLetter(): string {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

    return _.find(letters, refId => {
      return _.every(this.targets, other => {
        return other.refId !== refId;
      });
    });
  }

  destroy() {
    this.events.emit('panel-teardown');
    this.events.removeAllListeners();
  }
}
