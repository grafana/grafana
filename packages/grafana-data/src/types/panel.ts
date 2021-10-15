import { DataQueryError, DataQueryRequest, DataQueryTimings } from './datasource';
import { PluginMeta } from './plugin';
import { ScopedVars } from './ScopedVars';
import { LoadingState } from './data';
import { DataFrame, FieldType } from './dataFrame';
import { AbsoluteTimeRange, TimeRange, TimeZone } from './time';
import { EventBus } from '../events';
import { FieldConfigSource } from './fieldOverrides';
import { Registry } from '../utils';
import { StandardEditorProps } from '../field';
import { OptionsEditorItem } from './OptionsUIRegistryBuilder';
import { OptionEditorConfig } from './options';
import { AlertStateInfo } from './alerts';
import { PanelModel } from './dashboard';
import { DataTransformerConfig } from './transformations';
import { defaultsDeep } from 'lodash';

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

  /** Indicates whether or not panel should be rendered transparent */
  transparent: boolean;

  /** Current width of the panel */
  width: number;

  /** Current height of the panel */
  height: number;

  /** Field options configuration */
  fieldConfig: FieldConfigSource;

  /** @internal */
  renderCounter: number;

  /** Panel title */
  title: string;

  /** EventBus  */
  eventBus: EventBus;

  /** Panel options change handler */
  onOptionsChange: (options: T) => void;

  /** Field config change handler */
  onFieldConfigChange: (config: FieldConfigSource) => void;

  /** Template variables interpolation function */
  replaceVariables: InterpolateFunction;

  /** Time range change handler */
  onChangeTimeRange: (timeRange: AbsoluteTimeRange) => void;
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
  data?: PanelData;
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
  type?: 'submenu' | 'divider';
  text: string;
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

export interface PanelPluginDataSupport {
  annotations: boolean;
  alertStates: boolean;
}

/**
 * @alpha
 */
export interface VisualizationSuggestion<TOptions = any, TFieldConfig = any> {
  /** Name of suggestion */
  name: string;
  /** Description */
  description?: string;
  /** Panel plugin id */
  pluginId: string;
  /** Panel plugin options */
  options?: Partial<TOptions>;
  /** Panel plugin field options */
  fieldConfig?: FieldConfigSource<Partial<TFieldConfig>>;
  /** Data transformations */
  transformations?: DataTransformerConfig[];
  /** Tweak for small preview */
  previewModifier?: (suggestion: VisualizationSuggestion) => void;
}

/**
 * @alpha
 */
export class VisualizationSuggestionsBuilder {
  /** Current data */
  data?: PanelData;
  /** Current pluginId */
  pluginId: string;
  /** Current options */
  options: any;
  /** Current field config */
  fieldConfig: FieldConfigSource;
  /** List of suggestions */
  private list: VisualizationSuggestion[] = [];

  dataExists?: boolean;
  dataRowCount = 0;
  dataFrameCount = 0;
  dataNumberFieldCount = 0;
  dataTimeFieldCount = 0;
  dataStringFieldCount = 0;
  dataHasNumberField?: boolean;
  dataHasTimeField?: boolean;
  dataHasStringField?: boolean;

  constructor(data: PanelData | undefined, pluginId: string, options: any, fieldConfig: FieldConfigSource) {
    this.data = data;
    this.pluginId = pluginId;
    this.options = options;
    this.fieldConfig = fieldConfig;
    this.preComputeDataAttributes();
  }

  getListAppender<TOptions, TFieldConfig>(defaults: VisualizationSuggestion<TOptions, TFieldConfig>) {
    return new VisualizationSuggestionsListAppender<TOptions, TFieldConfig>(this.list, defaults);
  }

  /** Since many plugins implement suggestions suppliers separately and need these data attributes we precompute these here so they can be shared */
  preComputeDataAttributes() {
    if (!this.data?.series?.length) {
      return;
    }

    this.dataFrameCount = this.data.series.length;

    for (const frame of this.data.series) {
      this.dataRowCount += frame.length;

      for (const field of frame.fields) {
        switch (field.type) {
          case FieldType.number:
            this.dataNumberFieldCount += 1;
            break;
          case FieldType.time:
            this.dataTimeFieldCount += 1;
            break;
          case FieldType.string:
            this.dataStringFieldCount += 1;
            break;
        }
      }
    }

    this.dataExists = this.dataRowCount > 0;
    this.dataHasTimeField = this.dataTimeFieldCount > 0;
    this.dataHasNumberField = this.dataNumberFieldCount > 0;
    this.dataHasStringField = this.dataStringFieldCount > 0;
  }

  getList() {
    return this.list;
  }
}

/**
 * @alpha
 */
export type VisualizationSuggestionsSupplier = (builder: VisualizationSuggestionsBuilder) => void;

/**
 * Helps with typings and defaults
 * @alpha
 */
export class VisualizationSuggestionsListAppender<TOptions, TFieldConfig> {
  constructor(
    private list: VisualizationSuggestion[],
    private defaults: VisualizationSuggestion<TOptions, TFieldConfig>
  ) {}

  append(overrides: Partial<VisualizationSuggestion<TOptions, TFieldConfig>>) {
    this.list.push(defaultsDeep(overrides, this.defaults));
  }
}
