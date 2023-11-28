import { EditorMode } from '@grafana/experimental';
import { QueryFormat } from './types';
import { createFunctionField, setGroupByField } from './utils/sql.utils';
export function applyQueryDefaults(q) {
    var _a;
    let editorMode = (q === null || q === void 0 ? void 0 : q.editorMode) || EditorMode.Builder;
    // Switching to code editor if the query was created before visual query builder was introduced.
    if ((q === null || q === void 0 ? void 0 : q.editorMode) === undefined && (q === null || q === void 0 ? void 0 : q.rawSql) !== undefined) {
        editorMode = EditorMode.Code;
    }
    const result = Object.assign(Object.assign({}, q), { refId: (q === null || q === void 0 ? void 0 : q.refId) || 'A', format: (q === null || q === void 0 ? void 0 : q.format) !== undefined ? q.format : QueryFormat.Table, rawSql: (q === null || q === void 0 ? void 0 : q.rawSql) || '', editorMode, sql: (_a = q === null || q === void 0 ? void 0 : q.sql) !== null && _a !== void 0 ? _a : {
            columns: [createFunctionField()],
            groupBy: [setGroupByField()],
            limit: 50,
        } });
    return result;
}
//# sourceMappingURL=defaults.js.map