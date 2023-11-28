import { css } from '@emotion/css';
import React from 'react';
import { useStyles2 } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { useNavModel } from 'app/core/hooks/useNavModel';
import { NavLandingPageCard } from './NavLandingPageCard';
export function NavLandingPage({ navId, header }) {
    var _a;
    const { node } = useNavModel(navId);
    const styles = useStyles2(getStyles);
    const children = (_a = node.children) === null || _a === void 0 ? void 0 : _a.filter((child) => !child.hideFromTabs);
    return (React.createElement(Page, { navId: node.id },
        React.createElement(Page.Contents, null,
            React.createElement("div", { className: styles.content },
                header,
                children && children.length > 0 && (React.createElement("section", { className: styles.grid }, children === null || children === void 0 ? void 0 : children.map((child) => {
                    var _a;
                    return (React.createElement(NavLandingPageCard, { key: child.id, description: child.subTitle, text: child.text, url: (_a = child.url) !== null && _a !== void 0 ? _a : '' }));
                })))))));
}
const getStyles = (theme) => ({
    content: css({
        display: 'flex',
        flexDirection: 'column',
        gap: theme.spacing(2),
    }),
    grid: css({
        display: 'grid',
        gap: theme.spacing(3),
        gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
        gridAutoRows: '138px',
        padding: theme.spacing(2, 0),
    }),
});
//# sourceMappingURL=NavLandingPage.js.map