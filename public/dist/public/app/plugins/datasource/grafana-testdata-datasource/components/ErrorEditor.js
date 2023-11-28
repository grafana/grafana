import React from 'react';
import { InlineField, InlineFieldRow, Select } from '@grafana/ui';
const ERROR_OPTIONS = [
    {
        label: 'Server panic',
        value: 'server_panic',
    },
    {
        label: 'Frontend exception',
        value: 'frontend_exception',
    },
    {
        label: 'Frontend observable',
        value: 'frontend_observable',
    },
];
const FrontendErrorQueryEditor = ({ query, onChange }) => {
    return (React.createElement(InlineFieldRow, null,
        React.createElement(InlineField, { labelWidth: 14, label: "Error type" },
            React.createElement(Select, { options: ERROR_OPTIONS, value: query.errorType, onChange: (v) => {
                    onChange(Object.assign(Object.assign({}, query), { errorType: v.value }));
                } }))));
};
export default FrontendErrorQueryEditor;
//# sourceMappingURL=ErrorEditor.js.map