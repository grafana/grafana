import { DataTransformerConfig } from '@grafana/schema';

import { PreferredVisualisationType } from '../types/data';
import { FieldType } from '../types/dataFrame';
import { FieldConfigSource } from '../types/fieldOverrides';

import {
  VisualizationSuggestionsBuilder,
  VisualizationSuggestionsListAppender,
} from './VisualizationSuggestionsBuilder';

/**
 * summary info about panel data to help suggest visualizations
 */
export interface PanelDataSummary {
  hasData?: boolean;
  rowCountTotal: number;
  rowCountMax: number;
  frameCount: number;
  fieldCount: number;
  hasFieldType: (f: FieldType) => boolean;
  countFieldType: (f: FieldType) => number;
  /** The first frame that set's this value */
  preferredVisualisationType?: PreferredVisualisationType;

  /** ----- DEPRECATED FIELDS ----- **/
  /**
   * @deprecated use PanelDataSummary.countFieldType(FieldType.number)
   */
  numberFieldCount: number;
  /**
   * @deprecated use PanelDataSummary.countFieldType(FieldType.time)
   */
  timeFieldCount: number;
  /**
   * @deprecated use PanelDataSummary.countFieldType(FieldType.string)
   */
  stringFieldCount: number;

  /**
   * @deprecated use PanelDataSummary.hasFieldType(FieldType.number)
   */
  hasNumberField?: boolean;
  /**
   * @deprecated use PanelDataSummary.hasFieldType(FieldType.time)
   */
  hasTimeField?: boolean;
  /**
   * @deprecated use PanelDataSummary.hasFieldType(FieldType.string)
   */
  hasStringField?: boolean;
}

/**
 * @alpha
 */
export interface VisualizationSuggestion<TOptions extends object = {}, TFieldConfig extends object = {}> {
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
    previewModifier?: (suggestion: VisualizationSuggestion<TOptions, TFieldConfig>) => void;
    icon?: string;
    imgSrc?: string;
  };
  /** A value between 0-100 how suitable suggestion is */
  score?: VisualizationSuggestionScore;
}

/**
 * scores indicating how suitable a given VisualizationSuggestion is given the current data
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
 * interface which plugins may implement to provide visualization suggestions
 */
export interface VisualizationSuggestionsSupplier<TOptions extends {}, TFieldConfig extends {} = {}> {
  /**
   * Returns a list appender with default suggestion values set
   */
  getListAppender: (
    builder: VisualizationSuggestionsBuilder
  ) => VisualizationSuggestionsListAppender<TOptions, TFieldConfig>;

  /**
   * Adds good suitable suggestions for the current data
   */
  getSuggestionsForData: (builder: VisualizationSuggestionsBuilder) => void;
}
