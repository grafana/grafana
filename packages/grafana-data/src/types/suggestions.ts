/* eslint-disable @typescript-eslint/no-explicit-any */
import { defaultsDeep } from 'lodash';

import { DataTransformerConfig } from '@grafana/schema';

import { PanelDataSummary, getPanelDataSummary } from '../panel/suggestions/getPanelDataSummary';

import { PanelModel } from './dashboard';
import { FieldConfigSource } from './fieldOverrides';
import { PanelData } from './panel';

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
export class VisualizationSuggestionsBuilder {
  /** Summary stats for current data */
  dataSummary: PanelDataSummary;
  private list: VisualizationSuggestion[] = [];

  constructor(
    /** Current data */
    public data?: PanelData,
    /** Current panel & options */
    public panel?: PanelModel
  ) {
    this.dataSummary = getPanelDataSummary(data?.series);
  }

  getListAppender<TOptions, TFieldConfig>(defaults: VisualizationSuggestion<TOptions, TFieldConfig>) {
    return new VisualizationSuggestionsListAppender<TOptions, TFieldConfig>(this.list, defaults);
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
