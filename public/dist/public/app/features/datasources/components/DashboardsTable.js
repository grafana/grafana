import React from 'react';
import { Button, Icon } from '@grafana/ui';
export function DashboardsTable({ dashboards, onImport, onRemove }) {
    function buttonText(dashboard) {
        return dashboard.revision !== dashboard.importedRevision ? 'Update' : 'Re-import';
    }
    return (React.createElement("table", { className: "filter-table" },
        React.createElement("tbody", null, dashboards.map((dashboard, index) => {
            return (React.createElement("tr", { key: `${dashboard.dashboardId}-${index}` },
                React.createElement("td", { className: "width-1" },
                    React.createElement(Icon, { name: "apps" })),
                React.createElement("td", null, dashboard.imported ? (React.createElement("a", { href: dashboard.importedUrl }, dashboard.title)) : (React.createElement("span", null, dashboard.title))),
                React.createElement("td", { style: { textAlign: 'right' } },
                    !dashboard.imported ? (React.createElement(Button, { variant: "secondary", size: "sm", onClick: () => onImport(dashboard, false) }, "Import")) : (React.createElement(Button, { variant: "secondary", size: "sm", onClick: () => onImport(dashboard, true) }, buttonText(dashboard))),
                    dashboard.imported && (React.createElement(Button, { "aria-label": "Delete dashboard", icon: "trash-alt", variant: "destructive", size: "sm", onClick: () => onRemove(dashboard) })))));
        }))));
}
export default DashboardsTable;
//# sourceMappingURL=DashboardsTable.js.map