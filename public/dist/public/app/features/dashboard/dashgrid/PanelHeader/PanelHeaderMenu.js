import React from 'react';
import { selectors } from '@grafana/e2e-selectors';
import { Menu } from '@grafana/ui';
export function PanelHeaderMenu({ items }) {
    const renderItems = (items) => {
        return items.map((item) => {
            switch (item.type) {
                case 'divider':
                    return React.createElement(Menu.Divider, { key: item.text });
                case 'group':
                    return (React.createElement(Menu.Group, { key: item.text, label: item.text }, item.subMenu ? renderItems(item.subMenu) : undefined));
                default:
                    return (React.createElement(Menu.Item, { key: item.text, label: item.text, icon: item.iconClassName, childItems: item.subMenu ? renderItems(item.subMenu) : undefined, url: item.href, onClick: item.onClick, shortcut: item.shortcut, testId: selectors.components.Panels.Panel.menuItems(item.text) }));
            }
        });
    };
    return React.createElement(Menu, null, renderItems(items));
}
//# sourceMappingURL=PanelHeaderMenu.js.map