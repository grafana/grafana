import React from 'react';
import { selectors } from '@grafana/e2e-selectors';
import { Button } from '@grafana/ui';
export function ButtonRow({ canSave, canDelete, onDelete, onSubmit, onTest }) {
    return (React.createElement("div", { className: "gf-form-button-row" },
        React.createElement(Button, { type: "button", variant: "destructive", disabled: !canDelete, onClick: onDelete, "data-testid": selectors.pages.DataSource.delete }, "Delete"),
        canSave && (React.createElement(Button, { type: "submit", variant: "primary", disabled: !canSave, onClick: onSubmit, "data-testid": selectors.pages.DataSource.saveAndTest }, "Save & test")),
        !canSave && (React.createElement(Button, { variant: "primary", onClick: onTest }, "Test"))));
}
//# sourceMappingURL=ButtonRow.js.map