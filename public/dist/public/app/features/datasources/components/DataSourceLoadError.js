import React from 'react';
import { Button } from '@grafana/ui';
import { DataSourceReadOnlyMessage } from './DataSourceReadOnlyMessage';
export function DataSourceLoadError({ dataSourceRights, onDelete }) {
    const { readOnly, hasDeleteRights } = dataSourceRights;
    const canDelete = !readOnly && hasDeleteRights;
    const navigateBack = () => history.back();
    return (React.createElement(React.Fragment, null,
        readOnly && React.createElement(DataSourceReadOnlyMessage, null),
        React.createElement("div", { className: "gf-form-button-row" },
            canDelete && (React.createElement(Button, { type: "submit", variant: "destructive", onClick: onDelete }, "Delete")),
            React.createElement(Button, { variant: "secondary", fill: "outline", type: "button", onClick: navigateBack }, "Back"))));
}
//# sourceMappingURL=DataSourceLoadError.js.map