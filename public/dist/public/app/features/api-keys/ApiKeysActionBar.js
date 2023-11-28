import React from 'react';
import { FilterInput, InlineField } from '@grafana/ui';
export const ApiKeysActionBar = ({ searchQuery, disabled, onSearchChange }) => {
    return (React.createElement("div", { className: "page-action-bar" },
        React.createElement(InlineField, { grow: true },
            React.createElement(FilterInput, { placeholder: "Search keys", value: searchQuery, onChange: onSearchChange }))));
};
//# sourceMappingURL=ApiKeysActionBar.js.map