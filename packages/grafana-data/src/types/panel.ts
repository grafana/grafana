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
  /** Indicates that panel does not issue queries */
  skipDataQuery?: boolean;
  /** Indicates that panel should not be available in visualisation picker */
  hideFromList?: boolean;
  /** Sort order */
  sort: number;
}

export interface PanelData {
  /** State of the data (loading, done, error, streaming) */
  state: LoadingState;

  /** Contains data frames with field overrides applied */
  series: DataFrame[];

  /** Request contains the queries and properties sent to the datasource */
  request?: DataQueryRequest;

  /** Timing measurements */
  timings?: DataQueryTimings;

  /** Any query errors */
  error?: DataQueryError;

  /** Contains the range from the request or a shifted time range if a request uses relative time */
  timeRange: TimeRange;
}

export interface PanelProps<T = any> {
  /** ID of the panel within the current dashboard */
  id: number;
  /** Result set of panel queries */
  data: PanelData;
  /** Time range of the current dashboard */
  timeRange: TimeRange;
  /** Time zone of the current dashboard */
  timeZone: TimeZone;
  /** Panel options */
  options: T;
  /** Panel options change handler */
  onOptionsChange: (options: T) => void;
  /** Field options configuration */
  fieldConfig: FieldConfigSource;
  /** Field config change handler */
  onFieldConfigChange: (config: FieldConfigSource) => void;
  /** Indicathes whether or not panel should be rendered transparent */
  transparent: boolean;
  /** Current width of the panel */
  width: number;
  /** Current height of the panel */
  height: number;
  /** Template variables interpolation function */
  replaceVariables: InterpolateFunction;
  /** Time range change handler */
  onChangeTimeRange: (timeRange: AbsoluteTimeRange) => void;
  /** @internal */
  renderCounter: number;
}

export interface PanelEditorProps<T = any> {
  /** Panel options */
  options: T;
  /** Panel options change handler */
  onOptionsChange: (
    options: T,
    // callback can be used to run something right after update.
    callback?: () => void
  ) => void;
  /** Result set of panel queries */
  data: PanelData;
}

export interface PanelModel<TOptions = any> {
  /** ID of the panel within the current dashboard */
  id: number;
  /** Panel options */
  options: TOptions;
  /** Field options configuration */
  fieldConfig: FieldConfigSource;
  /** Version of the panel plugin */
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
  showIf?: (currentConfig: TOptions) => boolean | undefined;
}

/**
 * @internal
 */
export interface PanelMenuItem {
  type?: 'submenu' | 'divider';
  text?: string;
  iconClassName?: string;
  onClick?: (event: React.MouseEvent<any>) => void;
  shortcut?: string;
  href?: string;
  subMenu?: PanelMenuItem[];
}

/**
 * @internal
 */
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
