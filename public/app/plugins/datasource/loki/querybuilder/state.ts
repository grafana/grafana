import store from 'app/core/store';

import { QueryEditorMode } from '../../prometheus/querybuilder/shared/types';
import { LokiQuery, LokiQueryType } from '../types';

const queryEditorModeDefaultLocalStorageKey = 'LokiQueryEditorModeDefault';

export function changeEditorMode(query: LokiQuery, editorMode: QueryEditorMode, onChange: (query: LokiQuery) => void) {
  // If empty query store new mode as default
  if (query.expr === '') {
    store.set(queryEditorModeDefaultLocalStorageKey, editorMode);
  }

  onChange({ ...query, editorMode });
}

export function getDefaultEditorMode(expr: string) {
  // If we already have an expression default to code view
  if (expr != null && expr !== '') {
    return QueryEditorMode.Code;
  }

  const value: string | undefined = store.get(queryEditorModeDefaultLocalStorageKey);
  switch (value) {
    case 'code':
      return QueryEditorMode.Code;

    case 'builder':
    default:
      return QueryEditorMode.Builder;
  }
}

/**
 * Returns query with defaults, and boolean true/false depending on change was required
 */
export function getQueryWithDefaults(query: LokiQuery): LokiQuery {
  // If no expr (ie new query) then default to builder
  let result = query;

  if (!query.editorMode) {
    result = { ...query, editorMode: getDefaultEditorMode(query.expr) };
  }

  if (query.expr == null) {
    result = { ...result, expr: '' };
  }

  if (query.queryType == null) {
    // Default to range query
    result = { ...result, queryType: LokiQueryType.Range };
  }

  return result;
}
