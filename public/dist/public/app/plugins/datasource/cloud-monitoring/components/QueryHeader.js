import React from 'react';
import { EditorHeader, FlexItem, InlineSelect } from '@grafana/experimental';
import { QUERY_TYPES } from '../constants';
export const QueryHeader = (props) => {
    const { query, onChange, onRunQuery } = props;
    const { queryType } = query;
    return (React.createElement(EditorHeader, null,
        React.createElement(InlineSelect, { label: "Query type", options: QUERY_TYPES, value: queryType, onChange: ({ value }) => {
                onChange(Object.assign(Object.assign({}, query), { queryType: value }));
                onRunQuery();
            } }),
        React.createElement(FlexItem, { grow: 1 })));
};
//# sourceMappingURL=QueryHeader.js.map