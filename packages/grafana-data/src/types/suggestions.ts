import { DataTransformerConfig } from '@grafana/schema';

import { PanelDataSummary } from '../panel/suggestions/getPanelDataSummary';

import { FieldConfigSource } from './fieldOverrides';

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
export type VisualizationSuggestionsSupplierFn<TOptions extends unknown, TFieldConfig extends {} = {}> = (
  panelDataSummary: PanelDataSummary
) => Array<VisualizationSuggestion<TOptions, TFieldConfig>> | void;
