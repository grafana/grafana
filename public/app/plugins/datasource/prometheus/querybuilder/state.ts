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

function getDefaultEditorMode(expr: string) {
  // If we already have an expression default to code view
  if (expr != null && expr !== '') {
    return QueryEditorMode.Code;
  }

  const value = store.get(queryEditorModeDefaultLocalStorageKey) as QueryEditorMode;
  switch (value) {
    case QueryEditorMode.Builder:
    case QueryEditorMode.Code:
      return value;
    default:
      return QueryEditorMode.Builder;
  }
}

/**
 * Returns query with defaults, and boolean true/false depending on change was required
 */
export function getQueryWithDefaults(query: PromQuery, app: CoreApp | undefined): PromQuery {
  let result = query;

  if (!query.editorMode) {
    result = { ...query, editorMode: getDefaultEditorMode(query.expr) };
  }

  if (query.expr == null) {
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
