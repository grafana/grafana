import { css } from '@emotion/css';
import React from 'react';
import { useStyles2 } from '@grafana/ui';
import { NavBarMenuItem } from './NavBarMenuItem';
import { NavBarMenuSection } from './NavBarMenuSection';
import { isMatchOrChildMatch } from './utils';
export function NavBarMenuItemWrapper({ link, activeItem, onClose, }) {
    const styles = useStyles2(getStyles);
    if (link.emptyMessage && !linkHasChildren(link)) {
        return (React.createElement(NavBarMenuSection, { onClose: onClose, link: link, activeItem: activeItem },
            React.createElement("ul", { className: styles.children },
                React.createElement("div", { className: styles.emptyMessage }, link.emptyMessage))));
    }
    return (React.createElement(NavBarMenuSection, { onClose: onClose, link: link, activeItem: activeItem }, linkHasChildren(link) && (React.createElement("ul", { className: styles.children }, link.children.map((childLink) => {
        return (!childLink.isCreateAction && (React.createElement(NavBarMenuItem, { key: `${link.text}-${childLink.text}`, isActive: isMatchOrChildMatch(childLink, activeItem), isChild: true, onClick: () => {
                var _a;
                (_a = childLink.onClick) === null || _a === void 0 ? void 0 : _a.call(childLink);
                onClose();
            }, target: childLink.target, url: childLink.url }, childLink.text)));
    })))));
}
const getStyles = (theme) => ({
    children: css({
        display: 'flex',
        flexDirection: 'column',
    }),
    flex: css({
        display: 'flex',
    }),
    itemWithoutMenu: css({
        position: 'relative',
        placeItems: 'inherit',
        justifyContent: 'start',
        display: 'flex',
        flexGrow: 1,
        alignItems: 'center',
    }),
    fullWidth: css({
        height: '100%',
        width: '100%',
    }),
    iconContainer: css({
        display: 'flex',
        placeContent: 'center',
    }),
    itemWithoutMenuContent: css({
        display: 'grid',
        gridAutoFlow: 'column',
        gridTemplateColumns: `${theme.spacing(7)} auto`,
        alignItems: 'center',
        height: '100%',
    }),
    linkText: css({
        fontSize: theme.typography.pxToRem(14),
        justifySelf: 'start',
    }),
    emptyMessage: css({
        color: theme.colors.text.secondary,
        fontStyle: 'italic',
        padding: theme.spacing(1, 1.5, 1, 7),
    }),
});
function linkHasChildren(link) {
    return Boolean(link.children && link.children.length > 0);
}
//# sourceMappingURL=NavBarMenuItemWrapper.js.map