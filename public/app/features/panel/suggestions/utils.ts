import { PanelData, PanelDataSummary, PanelPluginVisualizationSuggestion } from '@grafana/data';

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
 * Checks if the panel has data
 * @param data - PanelData
 * @returns true if data exists and has at least one non-empty series
 */
export function hasData(data?: PanelData): boolean {
  return Boolean(data && data.series && data.series.length > 0 && data.series.some((frame) => frame.length > 0));
}
