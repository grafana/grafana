import React, { useState } from 'react';
import { Button, ConfirmModal } from '@grafana/ui';
import { contextSrv } from 'app/core/core';
import { AccessControlAction } from 'app/types';
export function AdminOrgsTable({ orgs, onDelete }) {
    const canDeleteOrgs = contextSrv.hasPermission(AccessControlAction.OrgsDelete);
    const [deleteOrg, setDeleteOrg] = useState();
    return (React.createElement("table", { className: "filter-table form-inline filter-table--hover" },
        React.createElement("thead", null,
            React.createElement("tr", null,
                React.createElement("th", null, "ID"),
                React.createElement("th", null, "Name"),
                React.createElement("th", { style: { width: '1%' } }))),
        React.createElement("tbody", null, orgs.map((org) => (React.createElement("tr", { key: `${org.id}-${org.name}` },
            React.createElement("td", { className: "link-td" },
                React.createElement("a", { href: `admin/orgs/edit/${org.id}` }, org.id)),
            React.createElement("td", { className: "link-td" },
                React.createElement("a", { href: `admin/orgs/edit/${org.id}` }, org.name)),
            React.createElement("td", { className: "text-right" },
                React.createElement(Button, { variant: "destructive", size: "sm", icon: "times", onClick: () => setDeleteOrg(org), "aria-label": "Delete org", disabled: !canDeleteOrgs })))))),
        deleteOrg && (React.createElement(ConfirmModal, { isOpen: true, icon: "trash-alt", title: "Delete", body: React.createElement("div", null,
                "Are you sure you want to delete '",
                deleteOrg.name,
                "'?",
                React.createElement("br", null),
                " ",
                React.createElement("small", null, "All dashboards for this organization will be removed!")), confirmText: "Delete", onDismiss: () => setDeleteOrg(undefined), onConfirm: () => {
                onDelete(deleteOrg.id);
                setDeleteOrg(undefined);
            } }))));
}
//# sourceMappingURL=AdminOrgsTable.js.map