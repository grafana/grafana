import { defaultsDeep } from 'lodash';

import { DataTransformerConfig } from '@grafana/schema';

import { PanelDataSummary, getPanelDataSummary } from '../panel/suggestions/getPanelDataSummary';

import { PanelModel } from './dashboard';
import { FieldConfigSource } from './fieldOverrides';
import { PanelData, PanelPluginMeta } from './panel';

/**
 * @alpha
 */
export interface VisualizationSuggestion<TOptions extends unknown = {}, TFieldConfig extends {} = {}> {
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

  getListAppender<TOptions extends unknown, TFieldConfig extends {} = {}>(
    defaults: VisualizationSuggestion<TOptions, TFieldConfig>
  ) {
    return new VisualizationSuggestionsListAppender<TOptions, TFieldConfig>(this.list, defaults);
  }

  getList() {
    return this.list;
  }
}

/**
 * @alpha
 * Configuration for suggestions defaults and presets
 */
export interface VisualizationSuggestionsConfig<TOptions extends unknown, TFieldConfig extends {}> {
  /**
   * Default suggestion options applied to all suggestions.
   * For example, in a suggestions handler, you could do something like
   * ```ts
   *   .setSuggestionsConfig({
   *     defaults: {
   *       options: {
   *         someOption: true,
   *       },
   *       fieldConfig: { ... },
   *     }
   *   })
   *   .setSuggestionsHandler((panelSummary) => {
   *     if (panelSummary.hasFieldType('string')) {
   *       return [{
   *         options: {
   *           someOtherOption: 'value',
   *         }
   *       }];
   *     }
   *   })
   * ```
   * This would result in the returned suggestion having both `someOption: true` and `someOtherOption: 'value'` set on its options.
   */
  defaults?: Partial<VisualizationSuggestion<TOptions, TFieldConfig>>;

  /**
   * Key-value map of named presets that can be used when returning suggestions.
   * For example, in a suggestions handler, you could do something like
   * ```ts
   *   .setSuggestionsConfig({
   *     presets: {
   *       stringsPreset1: {
   *         name: 'String values preset 1',
   *         options: {
   *           someOption: true,
   *         },
   *       },
   *       stringsPreset2: {
   *         name: 'String values preset 2',
   *         fieldConfig: { ... },
   *         options: {
   *           someOptions: false,
   *         },
   *       },
   *     }
   *   })
   *   .setSuggestionsHandler((panelSummary, presets) => {
   *     if (panelSummary.hasFieldType('string')) {
   *       return [presets.stringsPreset1, presets.stringsPreset2];
   *     }
   *   })
   * ```
   * This would result in two suggestions being shown, both extended with the defaults set in `defaults`.
   */
  presets?: Record<string, Partial<VisualizationSuggestion<TOptions, TFieldConfig>>>;
}

/**
 * @alpha
 * executed while rendering suggestions each time the DataFrame changes, this method
 * determines which suggestions can be shown for this PanelPlugin given the PanelDataSummary.
 *
 * - if a boolean is returned, the default options and field config will be used (including overrides set on useSuggestionsConfig)
 * - if an array of VisualizationSuggestion is returned, you may pass return presets (which are set using useSuggestionsConfig) or raw VisualizationSuggestions.
 *   - these will be extended with the defaults set in useSuggestionsConfig.
 * - if void is returned, no suggestions will be shown for this plugin (same as returning false)
 */
export type VisualizationSuggestionsHandler<TOptions extends unknown, TFieldConfig extends {} = {}> = (
  panelDataSummary: PanelDataSummary,
  presets?: VisualizationSuggestionsConfig<TOptions, TFieldConfig>['presets']
) => Array<Partial<VisualizationSuggestion<TOptions, TFieldConfig>>> | boolean | void;

/**
 * @internal
 */
export type VisualizationSuggestionsSupplier = {
  /**
   * Adds good suitable suggestions for the current data
   */
  getSuggestionsForData: (builder: VisualizationSuggestionsBuilder) => void;
};

/**
 * @internal
 */
export class VisualizationSuggestionsListAppender<TOptions extends unknown, TFieldConfig extends {} = {}> {
  constructor(
    private list: VisualizationSuggestion[],
    private defaults: VisualizationSuggestionsConfig<TOptions, TFieldConfig>['defaults']
  ) {}

  append(overrides: Partial<VisualizationSuggestion<TOptions, TFieldConfig>>) {
    this.list.push(defaultsDeep(overrides, this.defaults));
  }

  appendAll(overridesList: Array<Partial<VisualizationSuggestion<TOptions, TFieldConfig>>>) {
    this.list.push(...overridesList.map((o) => defaultsDeep(o, this.defaults)));
  }
}
