import { css } from '@emotion/css';
import React from 'react';
import { Dropdown, Icon, Menu, ToolbarButton, useStyles2, PanelChrome } from '@grafana/ui';
export function PanelLinks({ panelLinks, onShowPanelLinks }) {
    const styles = useStyles2(getStyles);
    const getLinksContent = () => {
        const interpolatedLinks = onShowPanelLinks();
        return (React.createElement(Menu, null, interpolatedLinks === null || interpolatedLinks === void 0 ? void 0 : interpolatedLinks.map((link, idx) => {
            return React.createElement(Menu.Item, { key: idx, label: link.title, url: link.href, target: link.target, onClick: link.onClick });
        })));
    };
    if (panelLinks.length === 1) {
        const linkModel = onShowPanelLinks()[0];
        return (React.createElement(PanelChrome.TitleItem, { href: linkModel.href, onClick: linkModel.onClick, target: linkModel.target, title: linkModel.title },
            React.createElement(Icon, { name: "external-link-alt", size: "md" })));
    }
    else {
        return (React.createElement(Dropdown, { overlay: getLinksContent },
            React.createElement(ToolbarButton, { icon: "external-link-alt", iconSize: "md", "aria-label": "panel links", className: styles.menuTrigger })));
    }
}
const getStyles = (theme) => {
    return {
        menuTrigger: css({
            height: '100%',
            background: 'inherit',
            border: 'none',
            borderRadius: `${theme.shape.radius.default}`,
            cursor: 'context-menu',
        }),
    };
};
//# sourceMappingURL=PanelLinks.js.map