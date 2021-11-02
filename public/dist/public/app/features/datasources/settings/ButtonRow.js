import React from 'react';
import { selectors } from '@grafana/e2e-selectors';
import { Button, LinkButton } from '@grafana/ui';
import { AccessControlAction } from 'app/types/';
import { contextSrv } from 'app/core/core';
var ButtonRow = function (_a) {
    var isReadOnly = _a.isReadOnly, onDelete = _a.onDelete, onSubmit = _a.onSubmit, onTest = _a.onTest, exploreUrl = _a.exploreUrl;
    var canEditDataSources = !isReadOnly && contextSrv.hasPermission(AccessControlAction.DataSourcesWrite);
    var canDeleteDataSources = !isReadOnly && contextSrv.hasPermission(AccessControlAction.DataSourcesDelete);
    var canExploreDataSources = contextSrv.hasPermission(AccessControlAction.DataSourcesExplore);
    return (React.createElement("div", { className: "gf-form-button-row" },
        React.createElement(Button, { variant: "secondary", fill: "solid", type: "button", onClick: function () { return history.back(); } }, "Back"),
        React.createElement(LinkButton, { variant: "secondary", fill: "solid", href: exploreUrl, disabled: !canExploreDataSources }, "Explore"),
        React.createElement(Button, { type: "button", variant: "destructive", disabled: !canDeleteDataSources, onClick: onDelete, "aria-label": selectors.pages.DataSource.delete }, "Delete"),
        canEditDataSources && (React.createElement(Button, { type: "submit", variant: "primary", disabled: !canEditDataSources, onClick: function (event) { return onSubmit(event); }, "aria-label": selectors.pages.DataSource.saveAndTest }, "Save & test")),
        !canEditDataSources && (React.createElement(Button, { type: "submit", variant: "primary", onClick: onTest }, "Test"))));
};
export default ButtonRow;
//# sourceMappingURL=ButtonRow.js.map