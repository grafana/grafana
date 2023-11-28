import React from 'react';
import { Button, Icon, Select, Tooltip } from '@grafana/ui';
export const PermissionListItem = ({ item, permissionLevels, canSet, onRemove, onChange }) => (React.createElement("tr", null,
    React.createElement("td", null, getAvatar(item)),
    React.createElement("td", null, getDescription(item)),
    React.createElement("td", null, item.isInherited && React.createElement("em", { className: "muted no-wrap" }, "Inherited from folder")),
    React.createElement("td", null,
        React.createElement(Select, { disabled: !canSet || !item.isManaged, onChange: (p) => onChange(item, p.value), value: permissionLevels.find((p) => p === item.permission), options: permissionLevels.map((p) => ({ value: p, label: p })) })),
    React.createElement("td", null,
        React.createElement(Tooltip, { content: getPermissionInfo(item) },
            React.createElement(Icon, { name: "info-circle" }))),
    React.createElement("td", null, item.isManaged ? (React.createElement(Button, { size: "sm", icon: "times", variant: "destructive", disabled: !canSet, onClick: () => onRemove(item), "aria-label": `Remove permission for ${getName(item)}` })) : (React.createElement(Tooltip, { content: item.isInherited ? 'Inherited Permission' : 'Provisioned Permission' },
        React.createElement(Button, { size: "sm", icon: "lock" }))))));
const getAvatar = (item) => {
    if (item.teamId) {
        return React.createElement("img", { className: "filter-table__avatar", src: item.teamAvatarUrl, alt: `Avatar for team ${item.teamId}` });
    }
    else if (item.userId) {
        return React.createElement("img", { className: "filter-table__avatar", src: item.userAvatarUrl, alt: `Avatar for user ${item.userId}` });
    }
    return React.createElement(Icon, { size: "xl", name: "shield" });
};
const getName = (item) => {
    if (item.userId) {
        return item.userLogin;
    }
    if (item.teamId) {
        return item.team;
    }
    return item.builtInRole;
};
const getDescription = (item) => {
    if (item.userId) {
        return React.createElement("span", { key: "name" },
            item.userLogin,
            " ");
    }
    else if (item.teamId) {
        return React.createElement("span", { key: "name" },
            item.team,
            " ");
    }
    else if (item.builtInRole) {
        return React.createElement("span", { key: "name" },
            item.builtInRole,
            " ");
    }
    return React.createElement("span", { key: "name" });
};
const getPermissionInfo = (p) => `Actions: ${[...new Set(p.actions)].sort().join(' ')}`;
//# sourceMappingURL=PermissionListItem.js.map