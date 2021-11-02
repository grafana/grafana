import React from 'react';
import { HorizontalGroup, LinkButton } from '@grafana/ui';
export var DashboardActions = function (_a) {
    var folderId = _a.folderId, isEditor = _a.isEditor, canEdit = _a.canEdit;
    var actionUrl = function (type) {
        var url = "dashboard/" + type;
        if (folderId) {
            url += "?folderId=" + folderId;
        }
        return url;
    };
    return (React.createElement("div", null,
        React.createElement(HorizontalGroup, { spacing: "md", align: "center" },
            canEdit && React.createElement(LinkButton, { href: actionUrl('new') }, "New Dashboard"),
            !folderId && isEditor && React.createElement(LinkButton, { href: "dashboards/folder/new" }, "New Folder"),
            canEdit && React.createElement(LinkButton, { href: actionUrl('import') }, "Import"))));
};
//# sourceMappingURL=DashboardActions.js.map