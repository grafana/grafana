import React, { useMemo } from 'react';
import { Trans } from 'app/core/internationalization';
import { PermissionListItem } from './PermissionListItem';
export const PermissionList = ({ title, items, compareKey, permissionLevels, canSet, onRemove, onChange }) => {
    const computed = useMemo(() => {
        const keep = {};
        for (let item of items) {
            const key = item[compareKey];
            if (!keep[key]) {
                keep[key] = item;
                continue;
            }
            if (item.actions.length > keep[key].actions.length) {
                keep[key] = item;
            }
        }
        return Object.keys(keep).map((k) => keep[k]);
    }, [items, compareKey]);
    if (computed.length === 0) {
        return null;
    }
    return (React.createElement("div", null,
        React.createElement("table", { className: "filter-table gf-form-group" },
            React.createElement("thead", null,
                React.createElement("tr", null,
                    React.createElement("th", { style: { width: '1%' } }),
                    React.createElement("th", null, title),
                    React.createElement("th", { style: { width: '1%' } }),
                    React.createElement("th", { style: { width: '40%' } },
                        React.createElement(Trans, { i18nKey: "access-control.permission-list.permission" }, "Permission")),
                    React.createElement("th", { style: { width: '1%' } }),
                    React.createElement("th", { style: { width: '1%' } }))),
            React.createElement("tbody", null, computed.map((item, index) => (React.createElement(PermissionListItem, { item: item, onRemove: onRemove, onChange: onChange, canSet: canSet, key: `${index}-${item.userId}`, permissionLevels: permissionLevels })))))));
};
//# sourceMappingURL=PermissionList.js.map