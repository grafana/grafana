import React from 'react';
import { Stack } from '@grafana/experimental';
import { NestedQuery } from './NestedQuery';
export function NestedQueryList(props) {
    var _a;
    const { query, datasource, onChange, onRunQuery, showExplain } = props;
    const nestedQueries = (_a = query.binaryQueries) !== null && _a !== void 0 ? _a : [];
    const onNestedQueryUpdate = (index, update) => {
        const updatedList = [...nestedQueries];
        updatedList.splice(index, 1, update);
        onChange(Object.assign(Object.assign({}, query), { binaryQueries: updatedList }));
    };
    const onRemove = (index) => {
        const updatedList = [...nestedQueries.slice(0, index), ...nestedQueries.slice(index + 1)];
        onChange(Object.assign(Object.assign({}, query), { binaryQueries: updatedList }));
    };
    return (React.createElement(Stack, { direction: "column", gap: 1 }, nestedQueries.map((nestedQuery, index) => (React.createElement(NestedQuery, { key: index.toString(), nestedQuery: nestedQuery, index: index, onChange: onNestedQueryUpdate, datasource: datasource, onRemove: onRemove, onRunQuery: onRunQuery, showExplain: showExplain })))));
}
//# sourceMappingURL=NestedQueryList.js.map