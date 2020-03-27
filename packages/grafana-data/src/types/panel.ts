import { ComponentClass, ComponentType } from 'react';
import { DataQueryError, DataQueryRequest, DataQueryTimings } from './datasource';
import { GrafanaPlugin, PluginMeta } from './plugin';
import { ScopedVars } from './ScopedVars';
import { LoadingState } from './data';
import { DataFrame } from './dataFrame';
import { AbsoluteTimeRange, TimeRange, TimeZone } from './time';
import { FieldConfigEditorRegistry, FieldConfigSource } from './fieldOverrides';

export type InterpolateFunction = (value: string, scopedVars?: ScopedVars, format?: string | Function) => string;

export interface PanelPluginMeta extends PluginMeta {
  skipDataQuery?: boolean;
  hideFromList?: boolean;
  sort: number;
}

export interface PanelData {
  /**
   * State of the data (loading, done, error, streaming)
   */
  state: LoadingState;

  /**
   * Contains data frames with field overrides applied
   */
  series: DataFrame[];

  /**
   * Request contains the queries and properties sent to the datasource
   */
  request?: DataQueryRequest;

  /**
   * Timing measurements
   */
  timings?: DataQueryTimings;

  /**
   * Any query errors
   */
  error?: DataQueryError;

  /**
   *  Contains the range from the request or a shifted time range if a request uses relative time
   */
  timeRange: TimeRange;
}

export interface PanelProps<T = any> {
  id: number; // ID within the current dashboard
  data: PanelData;
  timeRange: TimeRange;
  timeZone: TimeZone;
  options: T;
  onOptionsChange: (options: T) => void;
  /** Panel fields configuration */
  fieldConfig: FieldConfigSource;
  /** Enables panel field config manipulation */
  onFieldConfigChange: (config: FieldConfigSource) => void;
  renderCounter: number;
  transparent: boolean;
  width: number;
  height: number;
  replaceVariables: InterpolateFunction;
  onChangeTimeRange: (timeRange: AbsoluteTimeRange) => void;
}

export interface PanelEditorProps<T = any> {
  options: T;
  onOptionsChange: (
    options: T,
    // callback can be used to run something right after update.
    callback?: () => void
  ) => void;
  data: PanelData;

  /**
   * Panel fields configuration - temporart solution
   * TODO[FieldConfig]: Remove when we switch old editor to new
   */
  fieldConfig: FieldConfigSource;
  /**
   * Enables panel field config manipulation
   * TODO[FieldConfig]: Remove when we switch old editor to new
   */
  onFieldConfigChange: (config: FieldConfigSource) => void;
}

export interface PanelModel<TOptions = any> {
  id: number;
  options: TOptions;
  fieldConfig: FieldConfigSource;
  pluginVersion?: string;
  scopedVars?: ScopedVars;
}

/**
 * Called when a panel is first loaded with current panel model
 */
export type PanelMigrationHandler<TOptions = any> = (panel: PanelModel<TOptions>) => Partial<TOptions>;

/**
 * Called before a panel is initialized. Allows panel inspection for any updates before changing the panel type.
 */
export type PanelTypeChangedHandler<TOptions = any> = (
  panel: PanelModel<TOptions>,
  prevPluginId: string,
  prevOptions: any
) => Partial<TOptions>;

export class PanelPlugin<TOptions = any> extends GrafanaPlugin<PanelPluginMeta> {
  panel: ComponentType<PanelProps<TOptions>>;
  editor?: ComponentClass<PanelEditorProps<TOptions>>;
  customFieldConfigs?: FieldConfigEditorRegistry;
  defaults?: TOptions;
  fieldConfigDefaults?: FieldConfigSource = {
    defaults: {},
    overrides: [],
  };
  onPanelMigration?: PanelMigrationHandler<TOptions>;
  onPanelTypeChanged?: PanelTypeChangedHandler<TOptions>;
  noPadding?: boolean;

  /**
   * Legacy angular ctrl.  If this exists it will be used instead of the panel
   */
  angularPanelCtrl?: any;

  constructor(panel: ComponentType<PanelProps<TOptions>>) {
    super();
    this.panel = panel;
  }

  setEditor(editor: ComponentClass<PanelEditorProps<TOptions>>) {
    this.editor = editor;
    return this;
  }

  setDefaults(defaults: TOptions) {
    this.defaults = defaults;
    return this;
  }

  setNoPadding() {
    this.noPadding = true;
    return this;
  }

  /**
   * This function is called before the panel first loads if
   * the current version is different than the version that was saved.
   *
   * This is a good place to support any changes to the options model
   */
  setMigrationHandler(handler: PanelMigrationHandler) {
    this.onPanelMigration = handler;
    return this;
  }

  /**
   * This function is called when the visualization was changed. This
   * passes in the panel model for previous visualisation options inspection
   * and panel model updates.
   *
   * This is useful for supporting PanelModel API updates when changing
   * between Angular and React panels.
   */
  setPanelChangeHandler(handler: PanelTypeChangedHandler) {
    this.onPanelTypeChanged = handler;
    return this;
  }

  setCustomFieldConfigs(registry: FieldConfigEditorRegistry) {
    this.customFieldConfigs = registry;
    return this;
  }

  /**
   * Enables configuration of panel's default field config
   */
  setFieldConfigDefaults(defaultConfig: Partial<FieldConfigSource>) {
    this.fieldConfigDefaults = {
      defaults: {},
      overrides: [],
      ...defaultConfig,
    };

    return this;
  }
}

export interface PanelMenuItem {
  type?: 'submenu' | 'divider';
  text?: string;
  iconClassName?: string;
  onClick?: (event: React.MouseEvent<any>) => void;
  shortcut?: string;
  href?: string;
  subMenu?: PanelMenuItem[];
}

export interface AngularPanelMenuItem {
  click: Function;
  icon: string;
  href: string;
  divider: boolean;
  text: string;
  shortcut: string;
  submenu: any[];
}

export enum VizOrientation {
  Auto = 'auto',
  Vertical = 'vertical',
  Horizontal = 'horizontal',
}
