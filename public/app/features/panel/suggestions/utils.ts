import {
  DataFrameType,
  PanelData,
  PanelDataSummary,
  VisualizationSuggestion,
  VisualizationSuggestionScore,
} from '@grafana/data';
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
 * @internal
 * for panel plugins which render "scalar" data (stat, gauge, etc), this helper provides default reduce options
 * depending on whether deaggregation is likely needed.
 * @param suggestion the suggestion to modify
 * @param panelDataSummary the panel data summary to use for scoring
 * @param shouldUseRawValues if true, reduceOptions will be set to use raw values,
 *   otherwise a calcs will be used with the default value of `lastNotNull`.
 */
export function defaultNumericVizOptions(
  suggestion: VisualizationSuggestion<{ reduceOptions?: ReduceDataOptions }>,
  panelDataSummary: PanelDataSummary,
  shouldUseRawValues: boolean
): VisualizationSuggestion {
  suggestion.score =
    (suggestion.score ??
    (panelDataSummary.hasDataFrameType(DataFrameType.NumericLong) ||
      panelDataSummary.hasDataFrameType(DataFrameType.NumericWide) ||
      panelDataSummary.hasDataFrameType(DataFrameType.NumericMulti)))
      ? VisualizationSuggestionScore.Good
      : VisualizationSuggestionScore.OK;
  suggestion.options = suggestion.options ?? {};
  suggestion.options.reduceOptions =
    suggestion.options.reduceOptions ??
    (shouldUseRawValues
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

/**
 * @internal
 * Checks if the panel has data
 * @param data - PanelData
 * @returns true if data exists and has at least one non-empty series
 */
export function hasData(data?: PanelData): boolean {
  return Boolean(data && data.series && data.series.length > 0 && data.series.some((frame) => frame.length > 0));
}
