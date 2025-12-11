import { defaultsDeep } from 'lodash';

import { DataTransformerConfig } from '@grafana/schema';

import { getPanelDataSummary, PanelDataSummary } from '../panel/suggestions/getPanelDataSummary';

import { DataFrame } from './dataFrame';
import { FieldConfigSource } from './fieldOverrides';

/**
 * @internal
 * generates a hash for a suggestion based for use by the UI.
 */
export function getSuggestionHash(suggestion: Omit<PanelPluginVisualizationSuggestion, 'hash'>): string {
  return deterministicObjectHash(suggestion);
}

function strHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32bit integer
  }
  return hash.toString(36);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function deterministicObjectHash<T extends Record<string, any>>(obj: T): string {
  let result = '';
  for (const key of Object.keys(obj).sort()) {
    const value = obj[key];
    if (value === undefined) {
      continue;
    }
    result += key + ':';
    if (typeof value === 'object' && value !== null) {
      result += deterministicObjectHash(value);
    } else if (Array.isArray(value)) {
      result += value
        .map((v) => (typeof value === 'object' && value !== null ? deterministicObjectHash(v) : String(v)))
        .join(',');
    } else {
      result += String(value);
    }
    result += ';';
  }
  return strHash(result);
}

/**
 * @alpha
 * A suggestion for a visualization given some data. This represents the shape of the panel (including options and field config)
 * that will be used to show a small preview in the Grafana UI when suggesting visualizations in the Panel Editor.
 */
export interface VisualizationSuggestion<TOptions extends unknown = {}, TFieldConfig extends {} = {}> {
  /** Name of suggestion */
  name?: string;
  /** Description */
  description?: string;
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
    /**
     * Given that the suggestion is being rendered as a small preview, you may want to modify certain options
     * specifically for the smaller preview version of the visualization. In this method, you should directly
     * mutate the suggestion object which is passed in as the first argument.
     */
    previewModifier?: (suggestion: VisualizationSuggestion<TOptions, TFieldConfig>) => void;
    /** @deprecated this will no longer be supported in the new Suggestions UI. */
    icon?: string;
    /** @deprecated this will no longer be supported in the new Suggestions UI. */
    imgSrc?: string;
  };
}

/**
 * @internal
 * the internal interface that the PanelPlugin transforms the supplied suggestions into.
 */
export interface PanelPluginVisualizationSuggestion<TOptions extends unknown = {}, TFieldConfig extends {} = {}>
  extends VisualizationSuggestion<TOptions, TFieldConfig> {
  /** Name of suggestion */
  name: string;
  /** Panel plugin id */
  pluginId: string;
  /** unique hash assigned by Grafana for use by the UI. */
  hash: string;
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
 * TODO: this name is temporary; it will become just "VisualizationSuggestionsSupplier" when the other interface is deleted.
 *
 * executed while rendering suggestions each time the DataFrame changes, this method
 * determines which suggestions can be shown for this PanelPlugin given the PanelDataSummary.
 *
 * - returns an array of VisualizationSuggestions
 * - boolean return equates to "show a single suggestion card for this panel plugin with the default options" (true = show, false or void = hide)
 */
export type VisualizationSuggestionsSupplier<TOptions extends unknown, TFieldConfig extends {} = {}> = (
  panelDataSummary: PanelDataSummary
) => Array<VisualizationSuggestion<TOptions, TFieldConfig>> | void;

/**
 * DEPRECATED - the below exports need to remain in the code base to help make the transition for the Polystat plugin, which implements
 * suggestions using the old API. These should be removed for Grafana 13.
 */
/**
 * @deprecated use VisualizationSuggestionsSupplier
 */
export interface VisualizationSuggestionsSupplierDeprecated {
  getSuggestionsForData: (builder: VisualizationSuggestionsBuilder) => void;
}

/**
 * @deprecated use VisualizationSuggestionsSupplier
 */
export class VisualizationSuggestionsBuilder {
  public dataSummary: PanelDataSummary;
  public list: PanelPluginVisualizationSuggestion[] = [];

  constructor(dataFrames: DataFrame[]) {
    this.dataSummary = getPanelDataSummary(dataFrames);
  }

  getList(): PanelPluginVisualizationSuggestion[] {
    return this.list;
  }

  getListAppender(suggestionDefaults: Omit<PanelPluginVisualizationSuggestion, 'hash'>) {
    const withDefaults = (suggestion: VisualizationSuggestion): PanelPluginVisualizationSuggestion => {
      const s = defaultsDeep({}, suggestion, suggestionDefaults);
      return {
        ...s,
        hash: getSuggestionHash(s),
      };
    };
    return {
      append: (suggestion: VisualizationSuggestion) => {
        this.list.push(withDefaults(suggestion));
      },
    };
  }
}
