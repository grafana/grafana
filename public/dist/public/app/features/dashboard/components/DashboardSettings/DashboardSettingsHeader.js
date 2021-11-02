import React from 'react';
import { Icon, HorizontalGroup } from '@grafana/ui';
export var DashboardSettingsHeader = function (_a) {
    var onGoBack = _a.onGoBack, isEditing = _a.isEditing, title = _a.title;
    return (React.createElement("div", { className: "dashboard-settings__header" },
        React.createElement(HorizontalGroup, { align: "center", justify: "space-between" },
            React.createElement("h3", null,
                React.createElement("span", { onClick: onGoBack, className: isEditing ? 'pointer' : '' }, title),
                isEditing && (React.createElement("span", null,
                    React.createElement(Icon, { name: "angle-right" }),
                    " Edit"))))));
};
//# sourceMappingURL=DashboardSettingsHeader.js.map