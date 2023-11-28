import { css } from '@emotion/css';
import React, { useState } from 'react';
import { config, reportInteraction } from '@grafana/runtime';
import { useStyles2, MenuItem, Icon, ContextMenu } from '@grafana/ui';
const renderMenuItems = (links, styles, closeMenu, datasourceType) => {
    links.sort(function (linkA, linkB) {
        return (linkA.title || 'link').toLowerCase().localeCompare((linkB.title || 'link').toLowerCase());
    });
    return links.map((link, i) => (React.createElement(MenuItem, { key: i, label: link.title || 'Link', onClick: link.onClick
            ? (event) => {
                reportInteraction(`grafana_traces_trace_view_span_link_clicked`, {
                    datasourceType: datasourceType,
                    grafana_version: config.buildInfo.version,
                    type: link.type,
                    location: 'menu',
                });
                event === null || event === void 0 ? void 0 : event.preventDefault();
                link.onClick(event);
                closeMenu();
            }
            : undefined, url: link.href, className: styles.menuItem })));
};
export const SpanLinksMenu = ({ links, datasourceType, color }) => {
    const styles = useStyles2(() => getStyles(color));
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });
    const closeMenu = () => setIsMenuOpen(false);
    return (React.createElement("div", { "data-testid": "SpanLinksMenu", className: styles.wrapper },
        React.createElement("button", { onClick: (e) => {
                setIsMenuOpen(true);
                setMenuPosition({
                    x: e.pageX,
                    y: e.pageY,
                });
            }, className: styles.button },
            React.createElement(Icon, { name: "link", className: styles.icon })),
        isMenuOpen ? (React.createElement(ContextMenu, { onClose: () => setIsMenuOpen(false), renderMenuItems: () => renderMenuItems(links, styles, closeMenu, datasourceType), focusOnOpen: false, x: menuPosition.x, y: menuPosition.y })) : null));
};
const getStyles = (color) => {
    return {
        wrapper: css `
      border: none;
      background: ${color}10;
      border-bottom: 1px solid ${color}CF;
      padding-right: 4px;
    `,
        button: css `
      background: transparent;
      border: none;
      padding: 0;
    `,
        icon: css `
      background: transparent;
      border: none;
      padding: 0;
    `,
        menuItem: css `
      max-width: 60ch;
      overflow: hidden;
    `,
    };
};
//# sourceMappingURL=SpanLinks.js.map