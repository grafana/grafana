import React from 'react';
import { Button, FilterInput } from '@grafana/ui';
export var ApiKeysActionBar = function (_a) {
    var searchQuery = _a.searchQuery, disabled = _a.disabled, onAddClick = _a.onAddClick, onSearchChange = _a.onSearchChange;
    return (React.createElement("div", { className: "page-action-bar" },
        React.createElement("div", { className: "gf-form gf-form--grow" },
            React.createElement(FilterInput, { placeholder: "Search keys", value: searchQuery, onChange: onSearchChange })),
        React.createElement(Button, { className: "pull-right", onClick: onAddClick, disabled: disabled }, "Add API key")));
};
//# sourceMappingURL=ApiKeysActionBar.js.map