import { PanelDataSummary } from '@grafana/data';

/**
 * @internal
 * for panel plugins which want to simply indicate that they want to show or hide their default suggestion,
 * this helper would wrap a method which can return a boolean instead of `[{}]` or `undefined` as a bit of
 * syntactic sugar.
 */
export function showDefaultSuggestion(fn: (panelDataSummary: PanelDataSummary) => boolean | void) {
  return (panelDataSummary: PanelDataSummary) => (fn(panelDataSummary) ? [{}] : undefined);
}
