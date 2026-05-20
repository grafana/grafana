import { type EventBus } from '../events/types';
import { type StandardEditorProps } from '../field/standardFieldConfigEditorRegistry';
import { type Registry } from '../utils/Registry';

import { type OptionsEditorItem } from './OptionsUIRegistryBuilder';
import { type ScopedVars } from './ScopedVars';
import { type AlertStateInfo } from './alerts';
import { type PanelModel } from './dashboard';
import { type LoadingState } from './data';
import { type DataFrame } from './dataFrame';
import { type DataQueryError, type DataQueryRequest, type DataQueryTimings } from './datasource';
import { type FieldConfigSource } from './fieldOverrides';
import { type IconName } from './icon';
import { type LinkTarget } from './linkTarget';
import { type OptionEditorConfig } from './options';
import { type PluginMeta } from './plugin';
import { type AbsoluteTimeRange, type TimeRange, type TimeZone } from './time';

export type InterpolateFunction = (value: string, scopedVars?: ScopedVars, format?: string | Function) => string;

export interface PanelPluginMeta extends PluginMeta {
  /** Indicates that panel does not issue queries */
  skipDataQuery?: boolean;
  /** Indicates that the panel implements suggestions */
  suggestions?: boolean;
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

  /**
   * This is a key that will change when the DataFrame[] structure changes.
   * The revision is a useful way to know if only data has changed or data+structure
   */
  structureRev?: number;

  /** A list of annotation items */
  annotations?: DataFrame[];

  /**
   * @internal
   */
  alertState?: AlertStateInfo;

  /** Request contains the queries and properties sent to the datasource */
  request?: DataQueryRequest;

  /** Timing measurements */
  timings?: DataQueryTimings;

  /** Any query errors */
  errors?: DataQueryError[];
  /**
   * Single error for legacy reasons
   * @deprecated use errors instead -- will be removed in Grafana 10+
   */
  error?: DataQueryError;

  /** Contains the range from the request or a shifted time range if a request uses relative time */
  timeRange: TimeRange;

  /** traceIds collected during the processing of the requests */
  traceIds?: string[];
}

export interface PanelProps<T = any> {
  /** Unique ID of the panel within the current dashboard */
  id: number;

  /** Data available as result of running panel queries, includes dataframes and loading state **/
  data: PanelData;

  /** Time range of the current dashboard */
  timeRange: TimeRange;

  /** Time zone of the current dashboard */
  timeZone: TimeZone;

  /** Panel options set by the user in the panel editor. Includes both default and custom panel options */
  options: T;

  /** Indicates whether or not panel should be rendered transparent */
  transparent: boolean;

  /** Current width of the panel in pixels */
  width: number;

  /** Current height of the panel in pixels */
  height: number;

  /** Field options configuration. Controls how field values are displayed (e.g., units, min, max, decimals, thresholds) */
  fieldConfig: FieldConfigSource;

  /** @internal */
  renderCounter: number;

  /** Panel title */
  title: string;

  /** Grafana EventBus  */
  eventBus: EventBus;

  /** Handler for options change. Invoke it to update the panel custom options. */
  onOptionsChange: (options: T) => void;

  /** Field config change handler. Invoke it to update the panel field config. */
  onFieldConfigChange: (config: FieldConfigSource) => void;

  /** Template variables interpolation function. Given a string containing template variables, it returns the string with interpolated values. */
  replaceVariables: InterpolateFunction;

  /** Time range change handler */
  onChangeTimeRange: (timeRange: AbsoluteTimeRange) => void;
}

/**
 * Default vertical space (px) for PanelChrome header, padding, and border.
 * Used when {@link PanelNaturalHeightContext.chromeOverhead} is not provided.
 *
 * @public
 */
export const PANEL_CHROME_HEIGHT_OVERHEAD = 58;

/**
 * Context passed to a {@link PanelNaturalHeightSupplier}. The layout asks the
 * plugin how tall the panel wants to be and uses the returned number as-is;
 * the plugin is responsible for clamping to `minHeight`/`maxHeight` and
 * including chrome overhead.
 *
 * @public
 */
export interface PanelNaturalHeightContext<TOptions = unknown> {
  data: PanelData;
  options: TOptions;
  /** Inner content width in pixels (PanelChrome's innerWidth). */
  width: number;
  /** User-configured floor (px). The layout will not constrain — plugin must. */
  minHeight: number;
  /** User-configured cap (px). `Number.POSITIVE_INFINITY` when unlimited. */
  maxHeight: number;
  /**
   * Estimated PanelChrome overhead (px) for this panel. Set by
   * {@link VizPanel.getNaturalHeight} in `@grafana/scenes`; falls back to
   * {@link PANEL_CHROME_HEIGHT_OVERHEAD} in {@link clampPanelNaturalHeight}.
   */
  chromeOverhead?: number;
}

/**
 * Clamps inner content height plus chrome to the layout min/max bounds.
 *
 * @public
 */
export function clampPanelNaturalHeight(
  innerContentHeight: number,
  ctx: Pick<PanelNaturalHeightContext, 'minHeight' | 'maxHeight' | 'chromeOverhead'>
): number {
  const chrome = ctx.chromeOverhead ?? PANEL_CHROME_HEIGHT_OVERHEAD;
  return Math.min(ctx.maxHeight, Math.max(ctx.minHeight, innerContentHeight + chrome));
}

/**
 * Returns the **final wrapper height** in pixels, including chrome, clamped
 * to `ctx.minHeight`/`ctx.maxHeight`. The layout sets this value directly.
 * Return `undefined` to opt out (layout will use the configured default).
 *
 * @public
 */
export type PanelNaturalHeightSupplier<TOptions = unknown> = (
  ctx: PanelNaturalHeightContext<TOptions>
) => number | undefined;

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
  data?: PanelData;
}

/**
 * This type mirrors the required properties from PanelModel<TOptions> needed for migration handlers.
 *
 * By maintaining a separate type definition, we ensure that changes to PanelModel
 * that would break third-party migration handlers are caught at compile time,
 * rather than failing silently when third-party code attempts to use an incompatible panel.
 *
 * TOptions must be any to follow the same pattern as PanelModel<TOptions>
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface PanelMigrationModel<TOptions = any> {
  id: number;
  type: string;
  title?: string;
  options: TOptions;
  fieldConfig: PanelModel<TOptions>['fieldConfig'];
  pluginVersion?: string;
  targets?: PanelModel<TOptions>['targets'];
}

/**
 * Called when a panel is first loaded with current panel model to migrate panel options if needed.
 * Can return panel options, or a Promise that resolves to panel options for async migrations
 */
export type PanelMigrationHandler<TOptions = any> = (
  panel: PanelMigrationModel<TOptions>
) => Partial<TOptions> | Promise<Partial<TOptions>>;

/**
 * Called before a panel is initialized. Allows panel inspection for any updates before changing the panel type.
 */
export type PanelTypeChangedHandler<TOptions = any> = (
  panel: PanelModel<TOptions>,
  prevPluginId: string,
  prevOptions: Record<string, any>,
  prevFieldConfig: FieldConfigSource
) => Partial<TOptions>;

export type PanelOptionEditorsRegistry = Registry<PanelOptionsEditorItem>;

export interface PanelOptionsEditorProps<TValue> extends StandardEditorProps<TValue> {}

export interface PanelOptionsEditorItem<TOptions = any, TValue = any, TSettings = any>
  extends OptionsEditorItem<TOptions, TSettings, PanelOptionsEditorProps<TValue>, TValue> {}

export interface PanelOptionsEditorConfig<TOptions, TSettings = any, TValue = any>
  extends OptionEditorConfig<TOptions, TSettings, TValue> {}

/**
 * @internal
 */
export interface PanelMenuItem {
  type?: 'submenu' | 'divider' | 'group';
  text: string;
  iconClassName?: IconName;
  onClick?: (event: React.MouseEvent) => void;
  shortcut?: string;
  href?: string;
  target?: LinkTarget;
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

export interface PanelPluginDataSupport {
  annotations: boolean;
  alertStates: boolean;
}
