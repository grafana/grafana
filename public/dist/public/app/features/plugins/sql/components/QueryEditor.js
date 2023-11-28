import { __awaiter } from "tslib";
import React, { useCallback, useEffect, useState } from 'react';
import { useAsync } from 'react-use';
import { EditorMode, Space } from '@grafana/experimental';
import { applyQueryDefaults } from '../defaults';
import { haveColumns } from '../utils/sql.utils';
import { QueryHeader } from './QueryHeader';
import { RawEditor } from './query-editor-raw/RawEditor';
import { VisualEditor } from './visual-query-builder/VisualEditor';
export function SqlQueryEditor({ datasource, query, onChange, onRunQuery, range, queryHeaderProps, }) {
    var _a, _b, _c, _d, _e, _f;
    const [isQueryRunnable, setIsQueryRunnable] = useState(true);
    const db = datasource.getDB();
    const { preconfiguredDatabase } = datasource;
    const isPostgresInstance = !!(queryHeaderProps === null || queryHeaderProps === void 0 ? void 0 : queryHeaderProps.isPostgresInstance);
    const { loading, error } = useAsync(() => __awaiter(this, void 0, void 0, function* () {
        return () => {
            if (datasource.getDB(datasource.id).init !== undefined) {
                datasource.getDB(datasource.id).init();
            }
        };
    }), [datasource]);
    const queryWithDefaults = applyQueryDefaults(query);
    const [queryRowFilter, setQueryRowFilter] = useState({
        filter: !!((_a = queryWithDefaults.sql) === null || _a === void 0 ? void 0 : _a.whereString),
        group: !!((_d = (_c = (_b = queryWithDefaults.sql) === null || _b === void 0 ? void 0 : _b.groupBy) === null || _c === void 0 ? void 0 : _c[0]) === null || _d === void 0 ? void 0 : _d.property.name),
        order: !!((_f = (_e = queryWithDefaults.sql) === null || _e === void 0 ? void 0 : _e.orderBy) === null || _f === void 0 ? void 0 : _f.property.name),
        preview: true,
    });
    const [queryToValidate, setQueryToValidate] = useState(queryWithDefaults);
    useEffect(() => {
        return () => {
            if (datasource.getDB(datasource.id).dispose !== undefined) {
                datasource.getDB(datasource.id).dispose();
            }
        };
    }, [datasource]);
    const processQuery = useCallback((q) => {
        if (isQueryValid(q) && onRunQuery) {
            onRunQuery();
        }
    }, [onRunQuery]);
    const onQueryChange = (q, process = true) => {
        var _a, _b;
        setQueryToValidate(q);
        onChange(q);
        if (haveColumns((_a = q.sql) === null || _a === void 0 ? void 0 : _a.columns) && ((_b = q.sql) === null || _b === void 0 ? void 0 : _b.columns.some((c) => c.name)) && !queryRowFilter.group) {
            setQueryRowFilter(Object.assign(Object.assign({}, queryRowFilter), { group: true }));
        }
        if (process) {
            processQuery(q);
        }
    };
    const onQueryHeaderChange = (q) => {
        setQueryToValidate(q);
        onChange(q);
    };
    if (loading || error) {
        return null;
    }
    return (React.createElement(React.Fragment, null,
        React.createElement(QueryHeader, { db: db, preconfiguredDataset: preconfiguredDatabase, onChange: onQueryHeaderChange, onRunQuery: onRunQuery, onQueryRowChange: setQueryRowFilter, queryRowFilter: queryRowFilter, query: queryWithDefaults, isQueryRunnable: isQueryRunnable, isPostgresInstance: isPostgresInstance }),
        React.createElement(Space, { v: 0.5 }),
        queryWithDefaults.editorMode !== EditorMode.Code && (React.createElement(VisualEditor, { db: db, query: queryWithDefaults, onChange: (q) => onQueryChange(q, false), queryRowFilter: queryRowFilter, onValidate: setIsQueryRunnable, range: range })),
        queryWithDefaults.editorMode === EditorMode.Code && (React.createElement(RawEditor, { db: db, query: queryWithDefaults, queryToValidate: queryToValidate, onChange: onQueryChange, onRunQuery: onRunQuery, onValidate: setIsQueryRunnable, range: range }))));
}
const isQueryValid = (q) => {
    return Boolean(q.rawSql);
};
//# sourceMappingURL=QueryEditor.js.map