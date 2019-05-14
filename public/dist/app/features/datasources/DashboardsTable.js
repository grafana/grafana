import React from 'react';
var DashboardsTable = function (_a) {
    var dashboards = _a.dashboards, onImport = _a.onImport, onRemove = _a.onRemove;
    function buttonText(dashboard) {
        return dashboard.revision !== dashboard.importedRevision ? 'Update' : 'Re-import';
    }
    return (React.createElement("table", { className: "filter-table" },
        React.createElement("tbody", null, dashboards.map(function (dashboard, index) {
            return (React.createElement("tr", { key: dashboard.dashboardId + "-" + index },
                React.createElement("td", { className: "width-1" },
                    React.createElement("i", { className: "icon-gf icon-gf-dashboard" })),
                React.createElement("td", null, dashboard.imported ? (React.createElement("a", { href: dashboard.importedUrl }, dashboard.title)) : (React.createElement("span", null, dashboard.title))),
                React.createElement("td", { style: { textAlign: 'right' } },
                    !dashboard.imported ? (React.createElement("button", { className: "btn btn-secondary btn-small", onClick: function () { return onImport(dashboard, false); } }, "Import")) : (React.createElement("button", { className: "btn btn-secondary btn-small", onClick: function () { return onImport(dashboard, true); } }, buttonText(dashboard))),
                    dashboard.imported && (React.createElement("button", { className: "btn btn-danger btn-small", onClick: function () { return onRemove(dashboard); } },
                        React.createElement("i", { className: "fa fa-trash" }))))));
        }))));
};
export default DashboardsTable;
//# sourceMappingURL=DashboardsTable.js.map