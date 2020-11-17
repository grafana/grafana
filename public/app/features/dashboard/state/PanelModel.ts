// Libraries
import _ from 'lodash';
// Utils
import { getTemplateSrv } from '@grafana/runtime';
import { Emitter } from 'app/core/utils/emitter';
import { getNextRefIdChar } from 'app/core/utils/query';
// Types
import {
  AppEvent,
  DataConfigSource,
  DataLink,
  DataQuery,
  DataTransformerConfig,
  eventFactory,
  FieldConfigSource,
  PanelEvents,
  PanelPlugin,
  ScopedVars,
  ThresholdsConfig,
  ThresholdsMode,
  DataFrameDTO,
} from '@grafana/data';
import { EDIT_PANEL_ID } from 'app/core/constants';
import config from 'app/core/config';
import { PanelQueryRunner } from './PanelQueryRunner';
import { getDatasourceSrv } from '../../plugins/datasource_srv';
import { CoreEvents } from '../../../types';

export const panelAdded = eventFactory<PanelModel | undefined>('panel-added');
export const panelRemoved = eventFactory<PanelModel | undefined>('panel-removed');

export interface GridPos {
  x: number;
  y: number;
  w: number;
  h: number;
  static?: boolean;
}

const notPersistedProperties: { [str: string]: boolean } = {
  events: true,
  isViewing: true,
  isEditing: true,
  isInView: true,
  hasRefreshed: true,
  cachedPluginOptions: true,
  plugin: true,
  queryRunner: true,
  replaceVariables: true,
  editSourceId: true,
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
  fieldConfig: true,
  editSourceId: true,
  maxDataPoints: true,
  interval: true,
};

const defaults: any = {
  gridPos: { x: 0, y: 0, h: 3, w: 6 },
  targets: [{ refId: 'A' }],
  cachedPluginOptions: {},
  transparent: false,
  options: {},
  datasource: null,
};

export class PanelModel implements DataConfigSource {
  /* persisted id, used in URL to identify a panel */
  id: number;
  editSourceId: number;
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
  targets: DataQuery[];
  transformations?: DataTransformerConfig[];
  datasource: string | null;
  thresholds?: any;
  pluginVersion?: string;

  snapshotData?: DataFrameDTO[];
  timeFrom?: any;
  timeShift?: any;
  hideTimeOverride?: any;
  options: {
    [key: string]: any;
  };
  fieldConfig: FieldConfigSource;

  maxDataPoints?: number;
  interval?: string;
  description?: string;
  links?: DataLink[];
  transparent: boolean;

  // non persisted
  isViewing: boolean;
  isEditing: boolean;
  isInView: boolean;

  hasRefreshed: boolean;
  events: Emitter;
  cacheTimeout?: any;
  cachedPluginOptions?: any;
  legend?: { show: boolean; sort?: string; sortDesc?: boolean };
  plugin?: PanelPlugin;

  private queryRunner?: PanelQueryRunner;

  constructor(model: any) {
    this.events = new Emitter();
    this.restoreModel(model);
    this.replaceVariables = this.replaceVariables.bind(this);
  }

  /** Given a persistened PanelModel restores property values */
  restoreModel(model: any) {
    // Start with clean-up
    for (const property in this) {
      if (notPersistedProperties[property] || !this.hasOwnProperty(property)) {
        continue;
      }

      if (model[property]) {
        continue;
      }

      if (typeof (this as any)[property] === 'function') {
        continue;
      }

      if (typeof (this as any)[property] === 'symbol') {
        continue;
      }

      delete (this as any)[property];
    }

    // copy properties from persisted model
    for (const property in model) {
      (this as any)[property] = model[property];
    }

    // defaults
    _.defaultsDeep(this, _.cloneDeep(defaults));

    // queries must have refId
    this.ensureQueryIds();
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

  getOptions() {
    return this.options;
  }

  getFieldConfig() {
    return this.fieldConfig;
  }

  updateOptions(options: object) {
    this.options = options;
    this.render();
  }

  updateFieldConfig(config: FieldConfigSource) {
    this.fieldConfig = config;

    this.resendLastResult();
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

    if (model.datasource === undefined) {
      // This is part of defaults as defaults are removed in save model and
      // this should not be removed in save model as exporter needs to templatize it
      model.datasource = null;
    }

    return model;
  }

  setIsViewing(isViewing: boolean) {
    this.isViewing = isViewing;
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

    this.fieldConfig = applyFieldConfigDefaults(this.fieldConfig, this.plugin!.fieldConfigDefaults);
  }

  pluginLoaded(plugin: PanelPlugin) {
    this.plugin = plugin;

    if (plugin.onPanelMigration) {
      const version = getPluginVersion(plugin);

      if (version !== this.pluginVersion) {
        this.options = plugin.onPanelMigration(this);
        this.pluginVersion = version;
      }
    }

    this.applyPluginOptionDefaults(plugin);
    this.resendLastResult();
  }

  changePlugin(newPlugin: PanelPlugin) {
    const pluginId = newPlugin.meta.id;
    const oldOptions: any = this.getOptionsToRemember();
    const oldPluginId = this.type;
    const wasAngular = this.isAngularPlugin();

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
      Object.assign(this.options, newPlugin.onPanelTypeChanged(this, oldPluginId, old));
    }

    // switch
    this.type = pluginId;
    this.plugin = newPlugin;

    // For some reason I need to rebind replace variables here, otherwise the viz repeater does not work
    this.replaceVariables = this.replaceVariables.bind(this);
    this.applyPluginOptionDefaults(newPlugin);

    if (newPlugin.onPanelMigration) {
      this.pluginVersion = getPluginVersion(newPlugin);
    }
  }

  updateQueries(queries: DataQuery[]) {
    this.events.emit(CoreEvents.queryChanged);
    this.targets = queries;
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
    sourceModel.editSourceId = this.id;

    const clone = new PanelModel(sourceModel);
    clone.isEditing = true;
    const sourceQueryRunner = this.getQueryRunner();

    // Copy last query result
    clone.getQueryRunner().useLastResultFrom(sourceQueryRunner);

    return clone;
  }

  getTransformations() {
    return this.transformations;
  }

  getFieldOverrideOptions() {
    if (!this.plugin) {
      return undefined;
    }

    return {
      fieldConfig: this.fieldConfig,
      replaceVariables: this.replaceVariables,
      getDataSourceSettingsByUid: getDatasourceSrv().getDataSourceSettingsByUid.bind(getDatasourceSrv()),
      fieldConfigRegistry: this.plugin.fieldConfigRegistry,
      theme: config.theme,
    };
  }

  getQueryRunner(): PanelQueryRunner {
    if (!this.queryRunner) {
      this.queryRunner = new PanelQueryRunner(this);
    }
    return this.queryRunner;
  }

  hasTitle() {
    return this.title && this.title.length > 0;
  }

  isAngularPlugin(): boolean {
    return (this.plugin && this.plugin.angularPanelCtrl) !== undefined;
  }

  destroy() {
    this.events.emit(PanelEvents.panelTeardown);
    this.events.removeAllListeners();

    if (this.queryRunner) {
      this.queryRunner.destroy();
    }
  }

  setTransformations(transformations: DataTransformerConfig[]) {
    this.events.emit(CoreEvents.transformationChanged);
    this.transformations = transformations;
    this.resendLastResult();
  }

  replaceVariables(value: string, extraVars?: ScopedVars, format?: string) {
    let vars = this.scopedVars;
    if (extraVars) {
      vars = vars ? { ...vars, ...extraVars } : extraVars;
    }
    return getTemplateSrv().replace(value, vars, format);
  }

  resendLastResult() {
    if (!this.plugin) {
      return;
    }

    this.getQueryRunner().resendLastResult();
  }

  /*
   * Panel have a different id while in edit mode (to more easily be able to discard changes)
   * Use this to always get the underlying source id
   * */
  getSavedId(): number {
    return this.editSourceId ?? this.id;
  }

  on<T>(event: AppEvent<T>, callback: (payload?: T) => void) {
    this.events.on(event, callback);
  }

  off<T>(event: AppEvent<T>, callback: (payload?: T) => void) {
    this.events.off(event, callback);
  }
}

function applyFieldConfigDefaults(fieldConfig: FieldConfigSource, defaults: FieldConfigSource): FieldConfigSource {
  const result: FieldConfigSource = {
    defaults: _.mergeWith(
      {},
      defaults.defaults,
      fieldConfig ? fieldConfig.defaults : {},
      (objValue: any, srcValue: any): any => {
        if (_.isArray(srcValue)) {
          return srcValue;
        }
      }
    ),
    overrides: fieldConfig?.overrides ?? [],
  };

  // Thresholds base values are null in JSON but need to be converted to -Infinity
  if (result.defaults.thresholds) {
    fixThresholds(result.defaults.thresholds);
  }

  for (const override of result.overrides) {
    for (const property of override.properties) {
      if (property.id === 'thresholds') {
        fixThresholds(property.value as ThresholdsConfig);
      }
    }
  }

  return result;
}

function fixThresholds(thresholds: ThresholdsConfig) {
  if (!thresholds.mode) {
    thresholds.mode = ThresholdsMode.Absolute;
  }

  if (!thresholds.steps) {
    thresholds.steps = [];
  } else if (thresholds.steps.length) {
    // First value is always -Infinity
    // JSON saves it as null
    thresholds.steps[0].value = -Infinity;
  }
}

function getPluginVersion(plugin: PanelPlugin): string {
  return plugin && plugin.meta.info.version ? plugin.meta.info.version : config.buildInfo.version;
}
