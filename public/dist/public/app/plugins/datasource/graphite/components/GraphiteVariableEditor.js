import React, { useState } from 'react';
import { InlineField, Input, Select } from '@grafana/ui';
import { GraphiteQueryType } from '../types';
import { convertToGraphiteQueryObject } from './helpers';
const GRAPHITE_QUERY_VARIABLE_TYPE_OPTIONS = [
    { label: 'Default Query', value: GraphiteQueryType.Default },
    { label: 'Value Query', value: GraphiteQueryType.Value },
    { label: 'Metric Name Query', value: GraphiteQueryType.MetricName },
];
export const GraphiteVariableEditor = (props) => {
    var _a;
    const { query, onChange } = props;
    const [value, setValue] = useState(convertToGraphiteQueryObject(query));
    return (React.createElement(React.Fragment, null,
        React.createElement(InlineField, { label: "Select query type", labelWidth: 20 },
            React.createElement(Select, { "aria-label": "select query type", options: GRAPHITE_QUERY_VARIABLE_TYPE_OPTIONS, width: 25, value: (_a = value.queryType) !== null && _a !== void 0 ? _a : GraphiteQueryType.Default, onChange: (selectableValue) => {
                    var _a;
                    setValue(Object.assign(Object.assign({}, value), { queryType: selectableValue.value }));
                    if (value.target) {
                        onChange(Object.assign(Object.assign({}, value), { queryType: selectableValue.value }), (_a = value.target) !== null && _a !== void 0 ? _a : '');
                    }
                } })),
        React.createElement(InlineField, { label: "Query", labelWidth: 20, grow: true },
            React.createElement(Input, { "aria-label": "Variable editor query input", value: value.target, onBlur: () => { var _a; return onChange(value, (_a = value.target) !== null && _a !== void 0 ? _a : ''); }, onChange: (e) => {
                    setValue(Object.assign(Object.assign({}, value), { target: e.currentTarget.value }));
                } }))));
};
//# sourceMappingURL=GraphiteVariableEditor.js.map