import { ComponentClass, ComponentType } from 'react';
import { DataQueryError, DataQueryRequest, DataQueryTimings } from './datasource';
import { GrafanaPlugin, PluginMeta } from './plugin';
import { ScopedVars } from './ScopedVars';
import { LoadingState } from './data';
import { DataFrame } from './dataFrame';
import { AbsoluteTimeRange, TimeRange, TimeZone } from './time';
import { FieldConfigEditorRegistry, FieldConfigSource } from './fieldOverrides';
import { Registry, RegistryItem } from '../utils';
import { PanelOptionsEditorBuilder, FieldConfigEditorBuilder } from '../utils/OptionsUIBuilders';
import { StandardEditorProps } from '../field';

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

type OptionsUIRegisterHandler<T> = (builder: T) => void;
export type PanelOptionEditorsRegistry = Registry<PanelOptionsEditorItem>;

export class PanelPlugin<TOptions = any> extends GrafanaPlugin<PanelPluginMeta> {
  private customFieldConfigsUIBuilder = new FieldConfigEditorBuilder();
  private _customFieldConfigs?: FieldConfigEditorRegistry;
  private registerCustomFieldConfigs?: OptionsUIRegisterHandler<FieldConfigEditorBuilder>;

  private optionsUIBuilder = new PanelOptionsEditorBuilder();
  private _optionEditors?: PanelOptionEditorsRegistry;
  private registerOptionEditors?: OptionsUIRegisterHandler<PanelOptionsEditorBuilder>;

  panel: ComponentType<PanelProps<TOptions>>;
  editor?: ComponentClass<PanelEditorProps<TOptions>>;
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

  get customFieldConfigs() {
    if (!this._customFieldConfigs && this.registerCustomFieldConfigs) {
      this.registerCustomFieldConfigs(this.customFieldConfigsUIBuilder);
      this._customFieldConfigs = this.customFieldConfigsUIBuilder.getRegistry();
    }

    return this._customFieldConfigs;
  }

  get optionEditors() {
    if (!this._optionEditors && this.registerOptionEditors) {
      this.registerOptionEditors(this.optionsUIBuilder);
      this._optionEditors = this.optionsUIBuilder.getRegistry();
    }

    return this._optionEditors;
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

  setCustomFieldConfigs(builder: OptionsUIRegisterHandler<FieldConfigEditorBuilder>) {
    // builder is applied lazily when custom field configs are accessed
    this.registerCustomFieldConfigs = builder;
    return this;
  }

  setOptionsEditor(builder: OptionsUIRegisterHandler<PanelOptionsEditorBuilder>) {
    // builder is applied lazily when options UI is created
    this.registerOptionEditors = builder;
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

export interface PanelOptionsEditorProps<TValue> extends StandardEditorProps<TValue> {}

export interface PanelOptionsEditorItem<TValue = any, TSettings = any> extends RegistryItem {
  editor: ComponentType<PanelOptionsEditorProps<TValue>>;
  settings?: TSettings;
}

export interface PanelOptionsEditorConfig<TSettings = any, TValue = any>
  extends Pick<PanelOptionsEditorItem<TValue, TSettings>, 'id' | 'description' | 'name' | 'settings'> {}

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
