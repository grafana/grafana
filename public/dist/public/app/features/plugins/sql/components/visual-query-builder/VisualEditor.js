import { __awaiter } from "tslib";
import React from 'react';
import { useAsync } from 'react-use';
import { EditorRows, EditorRow, EditorField } from '@grafana/experimental';
import { QueryToolbox } from '../query-editor-raw/QueryToolbox';
import { Preview } from './Preview';
import { SQLGroupByRow } from './SQLGroupByRow';
import { SQLOrderByRow } from './SQLOrderByRow';
import { SQLSelectRow } from './SQLSelectRow';
import { SQLWhereRow } from './SQLWhereRow';
export const VisualEditor = ({ query, db, queryRowFilter, onChange, onValidate, range }) => {
    var _a;
    const state = useAsync(() => __awaiter(void 0, void 0, void 0, function* () {
        const fields = yield db.fields(query);
        return fields;
    }), [db, query.dataset, query.table]);
    return (React.createElement(React.Fragment, null,
        React.createElement(EditorRows, null,
            React.createElement(EditorRow, null,
                React.createElement(SQLSelectRow, { fields: state.value || [], query: query, onQueryChange: onChange, db: db })),
            queryRowFilter.filter && (React.createElement(EditorRow, null,
                React.createElement(EditorField, { label: "Filter by column value", optional: true },
                    React.createElement(SQLWhereRow, { fields: state.value || [], query: query, onQueryChange: onChange, db: db })))),
            queryRowFilter.group && (React.createElement(EditorRow, null,
                React.createElement(EditorField, { label: "Group by column" },
                    React.createElement(SQLGroupByRow, { fields: state.value || [], query: query, onQueryChange: onChange, db: db })))),
            queryRowFilter.order && (React.createElement(EditorRow, null,
                React.createElement(SQLOrderByRow, { fields: state.value || [], query: query, onQueryChange: onChange, db: db }))),
            queryRowFilter.preview && query.rawSql && (React.createElement(EditorRow, null,
                React.createElement(Preview, { rawSql: query.rawSql, datasourceType: (_a = query.datasource) === null || _a === void 0 ? void 0 : _a.type })))),
        React.createElement(QueryToolbox, { db: db, query: query, onValidate: onValidate, range: range })));
};
//# sourceMappingURL=VisualEditor.js.map