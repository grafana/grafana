import { css } from '@emotion/css';
import React from 'react';
import { useStyles2, TabsBar, Tab, toIconName } from '@grafana/ui';
export function PageTabs({ navItem }) {
    const styles = useStyles2(getStyles);
    return (React.createElement("div", { className: styles.tabsWrapper },
        React.createElement(TabsBar, null, navItem.children.map((child, index) => {
            const icon = child.icon ? toIconName(child.icon) : undefined;
            return (!child.hideFromTabs && (React.createElement(Tab, { label: child.text, active: child.active, key: `${child.url}-${index}`, icon: icon, href: child.url, suffix: child.tabSuffix })));
        }))));
}
const getStyles = (theme) => {
    return {
        tabsWrapper: css({
            paddingBottom: theme.spacing(3),
        }),
    };
};
//# sourceMappingURL=PageTabs.js.map