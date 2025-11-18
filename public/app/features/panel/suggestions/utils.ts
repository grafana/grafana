import { PanelDataSummary, VisualizationSuggestion } from '@grafana/data';
import { ReduceDataOptions } from '@grafana/schema';

/**
 * @internal
 * for panel plugins which want to simply indicate that they want to show or hide their default suggestion,
 * this helper would wrap a method which can return a boolean instead of `[{}]` or `undefined` as a bit of
 * syntactic sugar.
 */
export function showDefaultSuggestion(fn: (panelDataSummary: PanelDataSummary) => boolean | void) {
  return (panelDataSummary: PanelDataSummary) => (fn(panelDataSummary) ? [{}] : undefined);
}

/**
 * for panel plugins which render "scalar" data (stat, gauge, etc), this helper provides default reduce options
 * depending on whether deaggregation is likely needed.
 * @param shouldDeaggregate
 */
export function defaultReduceOptions(
  suggestion: VisualizationSuggestion<{ reduceOptions?: ReduceDataOptions }>,
  shouldDeaggregate: boolean
): VisualizationSuggestion {
  suggestion.options = suggestion.options ?? {};
  suggestion.options.reduceOptions =
    suggestion.options.reduceOptions ??
    (shouldDeaggregate
      ? {
          values: true,
          calcs: [],
        }
      : {
          values: false,
          calcs: ['lastNotNull'],
        });
  return suggestion;
}
