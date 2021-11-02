import { __assign, __read, __spreadArray } from "tslib";
import React, { useState } from 'react';
import { LinkSettingsEdit, LinkSettingsList } from '../LinksSettings';
import { newLink } from '../LinksSettings/LinkSettingsEdit';
import { DashboardSettingsHeader } from './DashboardSettingsHeader';
export var LinksSettings = function (_a) {
    var dashboard = _a.dashboard;
    var _b = __read(useState(null), 2), editIdx = _b[0], setEditIdx = _b[1];
    var onGoBack = function () {
        setEditIdx(null);
    };
    var onNew = function () {
        dashboard.links = __spreadArray(__spreadArray([], __read(dashboard.links), false), [__assign({}, newLink)], false);
        setEditIdx(dashboard.links.length - 1);
    };
    var onEdit = function (idx) {
        setEditIdx(idx);
    };
    var isEditing = editIdx !== null;
    return (React.createElement(React.Fragment, null,
        React.createElement(DashboardSettingsHeader, { onGoBack: onGoBack, title: "Dashboard links", isEditing: isEditing }),
        !isEditing && React.createElement(LinkSettingsList, { dashboard: dashboard, onNew: onNew, onEdit: onEdit }),
        isEditing && React.createElement(LinkSettingsEdit, { dashboard: dashboard, editLinkIdx: editIdx, onGoBack: onGoBack })));
};
//# sourceMappingURL=LinksSettings.js.map