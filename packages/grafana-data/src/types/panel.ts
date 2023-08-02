import { defaultsDeep } from 'lodash';

import { EventBus } from '../events';
import { StandardEditorProps } from '../field';
import { Registry } from '../utils';

import { OptionsEditorItem } from './OptionsUIRegistryBuilder';
import { ScopedVars } from './ScopedVars';
import { AlertStateInfo } from './alerts';
import { PanelModel } from './dashboard';
import { LoadingState, PreferredVisualisationType } from './data';
import { DataFrame, FieldType } from './dataFrame';
import { DataQueryError, DataQueryRequest, DataQueryTimings } from './datasource';
import { FieldConfigSource } from './fieldOverrides';
import { IconName } from './icon';
import { OptionEditorConfig } from './options';
import { PluginMeta } from './plugin';
import { AbsoluteTimeRange, TimeRange, TimeZone } from './time';
import { DataTransformerConfig } from './transformations';

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
  iconClassName?: IconName;
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
  /** Options for how to render suggestion card */
  cardOptions?: {
    /** Tweak for small preview */
    previewModifier?: (suggestion: VisualizationSuggestion) => void;
    icon?: string;
    imgSrc?: string;
  };
  /** A value between 0-100 how suitable suggestion is */
  score?: VisualizationSuggestionScore;
}

/**
 * @alpha
 */
export enum VisualizationSuggestionScore {
  /** We are pretty sure this is the best possible option */
  Best = 100,
  /** Should be a really good option */
  Good = 70,
  /** Can be visualized but there are likely better options. If no score is set this score is assumed */
  OK = 50,
}

/**
 * @alpha
 */
export interface PanelDataSummary {
  hasData?: boolean;
  rowCountTotal: number;
  rowCountMax: number;
  frameCount: number;
  fieldCount: number;
  numberFieldCount: number;
  timeFieldCount: number;
  stringFieldCount: number;
  hasNumberField?: boolean;
  hasTimeField?: boolean;
  hasStringField?: boolean;
  /** The first frame that set's this value */
  preferredVisualisationType?: PreferredVisualisationType;
}

/**
 * @alpha
 */
export class VisualizationSuggestionsBuilder {
  /** Current data */
  data?: PanelData;
  /** Current panel & options */
  panel?: PanelModel;
  /** Summary stats for current data */
  dataSummary: PanelDataSummary;

  private list: VisualizationSuggestion[] = [];

  constructor(data?: PanelData, panel?: PanelModel) {
    this.data = data;
    this.panel = panel;
    this.dataSummary = this.computeDataSummary();
  }

  getListAppender<TOptions, TFieldConfig>(defaults: VisualizationSuggestion<TOptions, TFieldConfig>) {
    return new VisualizationSuggestionsListAppender<TOptions, TFieldConfig>(this.list, defaults);
  }

  private computeDataSummary() {
    const frames = this.data?.series || [];

    let numberFieldCount = 0;
    let timeFieldCount = 0;
    let stringFieldCount = 0;
    let rowCountTotal = 0;
    let rowCountMax = 0;
    let fieldCount = 0;
    let preferredVisualisationType: PreferredVisualisationType | undefined;

    for (const frame of frames) {
      rowCountTotal += frame.length;

      if (frame.meta?.preferredVisualisationType) {
        preferredVisualisationType = frame.meta.preferredVisualisationType;
      }

      for (const field of frame.fields) {
        fieldCount++;

        switch (field.type) {
          case FieldType.number:
            numberFieldCount += 1;
            break;
          case FieldType.time:
            timeFieldCount += 1;
            break;
          case FieldType.string:
            stringFieldCount += 1;
            break;
        }
      }

      if (frame.length > rowCountMax) {
        rowCountMax = frame.length;
      }
    }

    return {
      numberFieldCount,
      timeFieldCount,
      stringFieldCount,
      rowCountTotal,
      rowCountMax,
      fieldCount,
      preferredVisualisationType,
      frameCount: frames.length,
      hasData: rowCountTotal > 0,
      hasTimeField: timeFieldCount > 0,
      hasNumberField: numberFieldCount > 0,
      hasStringField: stringFieldCount > 0,
    };
  }

  getList() {
    return this.list;
  }
}

/**
 * @alpha
 */
export type VisualizationSuggestionsSupplier = {
  /**
   * Adds good suitable suggestions for the current data
   */
  getSuggestionsForData: (builder: VisualizationSuggestionsBuilder) => void;
};

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
