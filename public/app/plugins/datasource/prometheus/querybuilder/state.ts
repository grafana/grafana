import { CoreApp } from '@grafana/data';
import store from 'app/core/store';

import { LegendFormatMode, PromQuery } from '../types';

import { QueryEditorMode } from './shared/types';

const queryEditorModeDefaultLocalStorageKey = 'PrometheusQueryEditorModeDefault';

export function changeEditorMode(query: PromQuery, editorMode: QueryEditorMode, onChange: (query: PromQuery) => void) {
  // If empty query store new mode as default
  if (query.expr === '') {
    store.set(queryEditorModeDefaultLocalStorageKey, editorMode);
  }

  onChange({ ...query, editorMode });
}

function getDefaultEditorMode(expr: string, defaultEditor: QueryEditorMode = QueryEditorMode.Builder): QueryEditorMode {
  // If we already have an expression default to code view
  if (expr != null && expr !== '') {
    return QueryEditorMode.Code;
  }

  const value: QueryEditorMode = store.get(queryEditorModeDefaultLocalStorageKey);
  switch (value) {
    case QueryEditorMode.Builder:
    case QueryEditorMode.Code:
      return value;
    default:
      return defaultEditor;
  }
}

/**
 * Returns query with defaults, and boolean true/false depending on change was required
 */
export function getQueryWithDefaults(
  query: PromQuery & { expr?: string },
  app: CoreApp | undefined,
  defaultEditor?: QueryEditorMode
): PromQuery {
  let result = query;

  if (!query.editorMode) {
    result = { ...query, editorMode: getDefaultEditorMode(query.expr, defaultEditor) };
  }

  // default query expr is now empty string, set in getDefaultQuery
  // While expr is required in the types, it is not always defined at runtime, so we need to check for undefined and default to an empty string to prevent runtime errors
  if (!query.expr) {
    result = { ...result, expr: '', legendFormat: LegendFormatMode.Auto };
  }

  if (query.range == null && query.instant == null) {
    // Default to range query
    result = { ...result, range: true };

    // In explore we default to both instant & range
    if (app === CoreApp.Explore) {
      result.instant = true;
    }
  }

  // Unified Alerting does not support "both" for query type – fall back to "range".
  const isBothInstantAndRange = query.instant && query.range;
  if (app === CoreApp.UnifiedAlerting && isBothInstantAndRange) {
    result = { ...result, instant: false, range: true };
  }

  return result;
}
