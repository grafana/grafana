import { DataQueryError, DataQueryRequest, DataQueryTimings } from './datasource';
import { PluginMeta } from './plugin';
import { ScopedVars } from './ScopedVars';
import { LoadingState } from './data';
import { DataFrame } from './dataFrame';
import { AbsoluteTimeRange, TimeRange, TimeZone } from './time';
import { FieldConfigSource } from './fieldOverrides';
import { Registry } from '../utils';
import { StandardEditorProps } from '../field';
import { OptionsEditorItem } from './OptionsUIRegistryBuilder';

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

export type PanelOptionEditorsRegistry = Registry<PanelOptionsEditorItem>;

export interface PanelOptionsEditorProps<TValue> extends StandardEditorProps<TValue> {}

export interface PanelOptionsEditorItem<TOptions = any, TValue = any, TSettings = any>
  extends OptionsEditorItem<TOptions, TSettings, PanelOptionsEditorProps<TValue>, TValue> {}

export interface PanelOptionsEditorConfig<TOptions, TSettings = any, TValue = any> {
  /**
   * Path of the option property to control.
   *
   * @example
   * Given options object of a type:
   * ```ts
   * interface Options {
   *   a: {
   *     b: string;
   *   }
   * }
   * ```
   *
   * path can be either 'a' or 'a.b'.
   */
  path: (keyof TOptions & string) | string;
  /**
   * Name of the option. Will be displayed in the UI as form element label.
   */
  name: string;
  /**
   * Description of the option. Will be displayed in the UI as form element description.
   */
  description?: string;
  /**al
   * Custom settings of the editor.
   */
  settings?: TSettings;
  /**
   * Array of strings representing category of the option. First element in the array will make option render as collapsible section.
   */
  category?: string[];
  defaultValue?: TValue;
  /**
   * Function that enables configuration of when option editor should be shown based on current panel option properties.
   *
   * @param currentConfig Current panel options
   */
  showIf?: (currentConfig: TOptions) => boolean;
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
