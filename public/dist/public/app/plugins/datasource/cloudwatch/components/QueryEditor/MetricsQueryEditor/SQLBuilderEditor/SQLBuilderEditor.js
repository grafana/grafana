import React, { useCallback, useEffect, useState } from 'react';
import { EditorField, EditorRow, EditorRows } from '@grafana/experimental';
import { Input } from '@grafana/ui';
import SQLGenerator from '../../../../language/cloudwatch-sql/SQLGenerator';
import SQLBuilderSelectRow from './SQLBuilderSelectRow';
import SQLFilter from './SQLFilter';
import SQLGroupBy from './SQLGroupBy';
import SQLOrderByGroup from './SQLOrderByGroup';
import { setSql } from './utils';
export const SQLBuilderEditor = ({ query, datasource, onChange }) => {
    var _a, _b;
    const sql = (_a = query.sql) !== null && _a !== void 0 ? _a : {};
    const onQueryChange = useCallback((query) => {
        var _a;
        const sqlGenerator = new SQLGenerator();
        const sqlString = sqlGenerator.expressionToSqlQuery((_a = query.sql) !== null && _a !== void 0 ? _a : {});
        const fullQuery = Object.assign(Object.assign({}, query), { sqlExpression: sqlString });
        onChange(fullQuery);
    }, [onChange]);
    const [sqlPreview, setSQLPreview] = useState();
    useEffect(() => {
        var _a;
        const sqlGenerator = new SQLGenerator();
        const sqlString = sqlGenerator.expressionToSqlQuery((_a = query.sql) !== null && _a !== void 0 ? _a : {});
        if (sqlPreview !== sqlString) {
            setSQLPreview(sqlString);
        }
    }, [query, sqlPreview, setSQLPreview]);
    return (React.createElement(EditorRows, null,
        React.createElement(EditorRow, null,
            React.createElement(SQLBuilderSelectRow, { query: query, onQueryChange: onQueryChange, datasource: datasource })),
        React.createElement(EditorRow, null,
            React.createElement(EditorField, { label: "Filter", optional: true },
                React.createElement(SQLFilter, { query: query, onQueryChange: onQueryChange, datasource: datasource }))),
        React.createElement(EditorRow, null,
            React.createElement(EditorField, { label: "Group by", optional: true },
                React.createElement(SQLGroupBy, { query: query, onQueryChange: onQueryChange, datasource: datasource })),
            React.createElement(SQLOrderByGroup, { query: query, onQueryChange: onQueryChange, datasource: datasource }),
            React.createElement(EditorField, { label: "Limit", optional: true },
                React.createElement(Input, { id: `${query.refId}-cloudwatch-sql-builder-editor-limit`, value: sql.limit, onChange: (e) => {
                        const val = e.currentTarget.valueAsNumber;
                        onQueryChange(setSql(query, { limit: isNaN(val) ? undefined : val }));
                    }, type: "number", min: 1 }))),
        sqlPreview && (React.createElement(EditorRow, null,
            process.env.NODE_ENV === 'development' && React.createElement("pre", null, JSON.stringify((_b = query.sql) !== null && _b !== void 0 ? _b : {}, null, 2)),
            React.createElement("pre", null, sqlPreview !== null && sqlPreview !== void 0 ? sqlPreview : '')))));
};
//# sourceMappingURL=SQLBuilderEditor.js.map