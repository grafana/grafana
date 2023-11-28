import React from 'react';
import { InlineFieldRow, InlineField } from '@grafana/ui';
const SearchField = ({ label, tooltip, children }) => {
    return (React.createElement(InlineFieldRow, null,
        React.createElement(InlineField, { label: label, labelWidth: 28, grow: true, tooltip: tooltip }, children)));
};
export default SearchField;
//# sourceMappingURL=InlineSearchField.js.map