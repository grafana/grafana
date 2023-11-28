import store from 'app/core/store';
import { QueryEditorMode } from '../../prometheus/querybuilder/shared/types';
import { LokiQueryType } from '../types';
const queryEditorModeDefaultLocalStorageKey = 'LokiQueryEditorModeDefault';
export function changeEditorMode(query, editorMode, onChange) {
    // If empty query store new mode as default
    if (query.expr === '') {
        store.set(queryEditorModeDefaultLocalStorageKey, editorMode);
    }
    onChange(Object.assign(Object.assign({}, query), { editorMode }));
}
export function getDefaultEditorMode(expr) {
    // If we already have an expression default to code view
    if (expr != null && expr !== '') {
        return QueryEditorMode.Code;
    }
    const value = store.get(queryEditorModeDefaultLocalStorageKey);
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
export function getQueryWithDefaults(query) {
    // If no expr (ie new query) then default to builder
    let result = query;
    if (!query.editorMode) {
        result = Object.assign(Object.assign({}, query), { editorMode: getDefaultEditorMode(query.expr) });
    }
    if (query.expr == null) {
        result = Object.assign(Object.assign({}, result), { expr: '' });
    }
    if (query.queryType == null) {
        // Default to range query
        result = Object.assign(Object.assign({}, result), { queryType: LokiQueryType.Range });
    }
    return result;
}
//# sourceMappingURL=state.js.map