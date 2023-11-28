import React from 'react';
import { EditorField, EditorRow } from '@grafana/experimental';
import { AutoSizeInput, RadioButtonGroup } from '@grafana/ui';
import { QueryOptionGroup } from 'app/plugins/datasource/prometheus/querybuilder/shared/QueryOptionGroup';
import { SearchTableType } from '../dataquery.gen';
import { DEFAULT_LIMIT, DEFAULT_SPSS } from '../datasource';
export const TempoQueryBuilderOptions = React.memo(({ onChange, query }) => {
    if (!query.hasOwnProperty('limit')) {
        query.limit = DEFAULT_LIMIT;
    }
    if (!query.hasOwnProperty('tableType')) {
        query.tableType = SearchTableType.Traces;
    }
    const onLimitChange = (e) => {
        onChange(Object.assign(Object.assign({}, query), { limit: parseInt(e.currentTarget.value, 10) }));
    };
    const onSpssChange = (e) => {
        onChange(Object.assign(Object.assign({}, query), { spss: parseInt(e.currentTarget.value, 10) }));
    };
    const onTableTypeChange = (val) => {
        onChange(Object.assign(Object.assign({}, query), { tableType: val }));
    };
    const collapsedInfoList = [
        `Limit: ${query.limit || DEFAULT_LIMIT}`,
        `Spans Limit: ${query.spss || DEFAULT_SPSS}`,
        `Table Format: ${query.tableType === SearchTableType.Traces ? 'Traces' : 'Spans'}`,
    ];
    return (React.createElement(React.Fragment, null,
        React.createElement(EditorRow, null,
            React.createElement(QueryOptionGroup, { title: "Options", collapsedInfo: collapsedInfoList },
                React.createElement(EditorField, { label: "Limit", tooltip: "Maximum number of traces to return." },
                    React.createElement(AutoSizeInput, { className: "width-4", placeholder: "auto", type: "number", min: 1, defaultValue: query.limit || DEFAULT_LIMIT, onCommitChange: onLimitChange, value: query.limit })),
                React.createElement(EditorField, { label: "Span Limit", tooltip: "Maximum number of spans to return for each span set." },
                    React.createElement(AutoSizeInput, { className: "width-4", placeholder: "auto", type: "number", min: 1, defaultValue: query.spss || DEFAULT_SPSS, onCommitChange: onSpssChange, value: query.spss })),
                React.createElement(EditorField, { label: "Table Format", tooltip: "How the query data should be displayed in the results table" },
                    React.createElement(RadioButtonGroup, { options: [
                            { label: 'Traces', value: SearchTableType.Traces },
                            { label: 'Spans', value: SearchTableType.Spans },
                        ], value: query.tableType, onChange: onTableTypeChange }))))));
});
TempoQueryBuilderOptions.displayName = 'TempoQueryBuilderOptions';
//# sourceMappingURL=TempoQueryBuilderOptions.js.map