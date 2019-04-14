import { ComponentClass } from 'react';
import { LoadingState, SeriesData, Field } from './data';
import { TimeRange } from './time';
import { ScopedVars } from './datasource';

/**
 * Represents options and an object to help pick it
 * selector: could be a string regex, maybe Field regex on name/type etc, maybe
 * cares about SeriesData#meta?
 */
export interface OptionsOverride<O extends any, S extends any> {
  selector: S;
  options: Partial<O>;
}

/**
 * Base options and an ordered list of overrides
 */
export interface PanelOptionsConfig<O extends any, S extends any> {
  options: Partial<O>;
  override?: OptionsOverride<O, S>[];
}

/**
 * Check if an override selection should be applied based on a field and series
 */
export type PanelOverrideTest<S extends any> = (
  selection: S, // null gives the default w/o overrids
  field: Field,
  series?: SeriesData
) => boolean;

export interface PanelConfigQuery<O extends any, S extends any> {
  // hardcoded of the PanelPlugin
  defaults: O;
  applies: PanelOverrideTest<S>;

  // List of configs to check
  configs: PanelOptionsConfig<O, S>[];

  // The variation of the query you want.  nothing for defaults
  field?: Field;
  series?: SeriesData;
}

/**
 * This function would be managed by the the DashGrid
 */
export function getPanelOptions<O extends any, S extends any>(query: PanelConfigQuery<O, S>): O {
  const { defaults, applies, configs, field, series } = query;
  let options = { ...defaults };
  for (const config of configs) {
    if (config.options) {
      options = { ...options, ...config.options };
    }
    if (config.override && field) {
      for (const override of config.override) {
        if (applies(override.selector, field, series)) {
          options = { ...options, ...config.options };
        }
      }
    }
  }
  return options;
}

export type InterpolateFunction = (value: string, scopedVars?: ScopedVars, format?: string | Function) => string;

export interface PanelProps<T = any> {
  data?: SeriesData[];
  timeRange: TimeRange;
  loading: LoadingState;
  options: T; // The options without any overrid
  getOption: (field: Field, series?: SeriesData) => T;
  renderCounter: number;
  width: number;
  height: number;
  replaceVariables: InterpolateFunction;
}

export interface PanelEditorProps<T = any> {
  default: Partial<T>; // The union of PanelProps & ones saved in the shared config
  options: Partial<T>; // Saved in the PanelModel
  onOptionsChange: (options: Partial<T>) => void;
}

export interface PanelOverrideProps<T = any> {
  options: Partial<T>; // The panel props (default+shared+panel)
  override: Partial<T>; // What could get applied
  onOverrideChange: (override: Partial<T>) => void;
}

export interface PanelOverrideSelectionProps<S = any> {
  selection: S;
  onSelectionChange: (selection: S) => void;
}

export interface PanelModel<TOptions = any> {
  id: number;
  options: TOptions;
  pluginVersion?: string;
}

/**
 * Called when a panel is first loaded with current panel model
 */
export type PanelMigrationHandler<TOptions = any> = (panel: PanelModel<TOptions>) => Partial<TOptions>;

/**
 * Called before a panel is initalized
 */
export type PanelTypeChangedHandler<TOptions = any> = (
  options: Partial<TOptions>,
  prevPluginId: string,
  prevOptions: any
) => Partial<TOptions>;

export class ReactPanelPlugin<TOptions = any, TSelector = any> {
  panel: ComponentClass<PanelProps<TOptions>>;
  editor?: ComponentClass<PanelEditorProps<TOptions>>;
  defaults?: TOptions;

  overrideTest?: PanelOverrideTest<TSelector>;
  overrideEditor?: ComponentClass<PanelOverrideProps<TOptions>>;
  overrideDisplay?: ComponentClass<PanelOverrideProps<TOptions>>;
  overrideSelectionDisplay?: ComponentClass<PanelOverrideSelectionProps<TSelector>>;
  overrideSelectionEditor?: ComponentClass<PanelOverrideSelectionProps<TSelector>>;

  onPanelMigration?: PanelMigrationHandler<TOptions>;
  onPanelTypeChanged?: PanelTypeChangedHandler<TOptions>;

  constructor(panel: ComponentClass<PanelProps<TOptions>>) {
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
   * This function is called when the visualization was changed.  This
   * passes in the options that were used in the previous visualization
   */
  setPanelChangeHandler(handler: PanelTypeChangedHandler) {
    this.onPanelTypeChanged = handler;
    return this;
  }
}

export class AngularPanelPlugin {
  components: {
    PanelCtrl: any;
  };

  constructor(PanelCtrl: any) {
    this.components = { PanelCtrl: PanelCtrl };
  }
}

export interface PanelSize {
  width: number;
  height: number;
}

export interface PanelMenuItem {
  type?: 'submenu' | 'divider';
  text?: string;
  iconClassName?: string;
  onClick?: () => void;
  shortcut?: string;
  subMenu?: PanelMenuItem[];
}

export enum MappingType {
  ValueToText = 1,
  RangeToText = 2,
}

interface BaseMap {
  id: number;
  operator: string;
  text: string;
  type: MappingType;
}

export type ValueMapping = ValueMap | RangeMap;

export interface ValueMap extends BaseMap {
  value: string;
}

export interface RangeMap extends BaseMap {
  from: string;
  to: string;
}

export enum VizOrientation {
  Auto = 'auto',
  Vertical = 'vertical',
  Horizontal = 'horizontal',
}
