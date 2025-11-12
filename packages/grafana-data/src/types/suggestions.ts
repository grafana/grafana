import { defaultsDeep } from 'lodash';

import { DataTransformerConfig } from '@grafana/schema';

import { PanelDataSummary, getPanelDataSummary } from '../panel/suggestions/getPanelDataSummary';

import { PanelModel } from './dashboard';
import { FieldConfigSource } from './fieldOverrides';
import { PanelData } from './panel';

/**
 * @alpha
 */
export interface VisualizationSuggestion<TOptions extends unknown = {}, TFieldConfig extends {} = {}> {
  /** Name of suggestion */
  name?: string;
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
  /** A value between 0-100 how suitable suggestion is */
  score?: VisualizationSuggestionScore;
  /** Options for how to render suggestion card */
  cardOptions?: {
    /** Tweak for small preview */
    previewModifier?: (suggestion: VisualizationSuggestion<TOptions, TFieldConfig>) => void;
    icon?: string;
    imgSrc?: string;
  };
}

/**
 * @internal
 * the internal interface that the panel plugin transforms the provided suggestions into.
 */
export interface PanelPluginVisualizationSuggestion<TOptions extends unknown = {}, TFieldConfig extends {} = {}>
  extends VisualizationSuggestion<TOptions, TFieldConfig> {
  /** Name of suggestion */
  name: string;
  /** Panel plugin id */
  pluginId: string;
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
 * @internal
 * TODO we can remove this from exports in the future.
 */
export class VisualizationSuggestionsBuilder {
  /** Summary stats for current data */
  dataSummary: PanelDataSummary;
  private list: PanelPluginVisualizationSuggestion[] = [];

  constructor(
    /** Current data */
    public data?: PanelData,
    /** Current panel & options */
    public panel?: PanelModel
  ) {
    this.dataSummary = getPanelDataSummary(data?.series);
  }

  getListAppender<TOptions extends unknown, TFieldConfig extends {} = {}>(
    defaults: PanelPluginVisualizationSuggestion<TOptions, TFieldConfig>
  ) {
    return new VisualizationSuggestionsListAppender<TOptions, TFieldConfig>(this.list, defaults);
  }

  getList() {
    return this.list;
  }
}

/**
 * @alpha
 * executed while rendering suggestions each time the DataFrame changes, this method
 * determines which suggestions can be shown for this PanelPlugin given the PanelDataSummary.
 *
 * - returns an array of VisualizationSuggestions
 * - boolean return equates to "show a single suggestion card for this panel plugin with the default options" (true = show, false or void = hide)
 */
export type VisualizationSuggestionsHandler<TOptions extends unknown, TFieldConfig extends {} = {}> = (
  panelDataSummary: PanelDataSummary
) => Array<VisualizationSuggestion<TOptions, TFieldConfig>> | boolean | void;

/**
 * @internal
 */
export type VisualizationSuggestionsSupplier = {
  /**
   * Adds suitable suggestions for the current data
   */
  getSuggestionsForData: (builder: VisualizationSuggestionsBuilder) => void;
};

/**
 * @internal
 */
export class VisualizationSuggestionsListAppender<TOptions extends unknown, TFieldConfig extends {} = {}> {
  constructor(
    private list: VisualizationSuggestion[],
    private defaults: Partial<PanelPluginVisualizationSuggestion<TOptions, TFieldConfig>> = {}
  ) {}

  append(suggestion: VisualizationSuggestion<TOptions, TFieldConfig>) {
    this.list.push(defaultsDeep(suggestion, this.defaults));
  }

  appendAll(suggestions: Array<VisualizationSuggestion<TOptions, TFieldConfig>>) {
    this.list.push(...suggestions.map((o) => defaultsDeep(o, this.defaults)));
  }
}
