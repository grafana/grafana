import React, { useMemo } from 'react';
import { Menu } from '@grafana/ui';
import { truncateTitle } from 'app/features/plugins/extensions/utils';
export function ToolbarExtensionPointMenu({ extensions, onSelect }) {
    const { categorised, uncategorised } = useExtensionLinksByCategory(extensions);
    const showDivider = uncategorised.length > 0 && Object.keys(categorised).length > 0;
    return (React.createElement(Menu, null,
        React.createElement(React.Fragment, null,
            Object.keys(categorised).map((category) => (React.createElement(Menu.Group, { key: category, label: truncateTitle(category, 25) }, renderItems(categorised[category], onSelect)))),
            showDivider && React.createElement(Menu.Divider, { key: "divider" }),
            renderItems(uncategorised, onSelect))));
}
function renderItems(extensions, onSelect) {
    return extensions.map((extension) => (React.createElement(Menu.Item, { ariaLabel: extension.title, icon: (extension === null || extension === void 0 ? void 0 : extension.icon) || 'plug', key: extension.id, label: truncateTitle(extension.title, 25), onClick: (event) => {
            var _a;
            if (extension.path) {
                return onSelect(extension);
            }
            (_a = extension.onClick) === null || _a === void 0 ? void 0 : _a.call(extension, event);
        } })));
}
function useExtensionLinksByCategory(extensions) {
    return useMemo(() => {
        const uncategorised = [];
        const categorised = {};
        for (const link of extensions) {
            if (!link.category) {
                uncategorised.push(link);
                continue;
            }
            if (!Array.isArray(categorised[link.category])) {
                categorised[link.category] = [];
            }
            categorised[link.category].push(link);
            continue;
        }
        return {
            uncategorised,
            categorised,
        };
    }, [extensions]);
}
//# sourceMappingURL=ToolbarExtensionPointMenu.js.map