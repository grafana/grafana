import { __rest } from "tslib";
import { css } from '@emotion/css';
import React, { forwardRef } from 'react';
import { useLocation } from 'react-router-dom';
import { CustomScrollbar, Icon, IconButton, useStyles2 } from '@grafana/ui';
import { Flex } from '@grafana/ui/src/unstable';
import { useGrafana } from 'app/core/context/GrafanaContext';
import { t } from 'app/core/internationalization';
import { useSelector } from 'app/types';
import { MegaMenuItem } from './MegaMenuItem';
import { enrichWithInteractionTracking, getActiveItem } from './utils';
export const MENU_WIDTH = '350px';
export const MegaMenu = React.memo(forwardRef((_a, ref) => {
    var { onClose } = _a, restProps = __rest(_a, ["onClose"]);
    const navTree = useSelector((state) => state.navBarTree);
    const styles = useStyles2(getStyles);
    const location = useLocation();
    const { chrome } = useGrafana();
    const state = chrome.useState();
    // Remove profile + help from tree
    const navItems = navTree
        .filter((item) => item.id !== 'profile' && item.id !== 'help')
        .map((item) => enrichWithInteractionTracking(item, true));
    const activeItem = getActiveItem(navItems, location.pathname);
    const handleDockedMenu = () => {
        chrome.setMegaMenu(state.megaMenu === 'docked' ? 'closed' : 'docked');
    };
    return (React.createElement("div", Object.assign({ "data-testid": "navbarmenu", ref: ref }, restProps),
        React.createElement("div", { className: styles.mobileHeader },
            React.createElement(Icon, { name: "bars", size: "xl" }),
            React.createElement(IconButton, { tooltip: t('navigation.megamenu.close', 'Close menu'), name: "times", onClick: onClose, size: "xl", variant: "secondary" })),
        React.createElement("nav", { className: styles.content },
            React.createElement(CustomScrollbar, { showScrollIndicators: true, hideHorizontalTrack: true },
                React.createElement("ul", { className: styles.itemList }, navItems.map((link, index) => (React.createElement(Flex, { key: link.text, direction: "row", alignItems: "center" },
                    React.createElement(MegaMenuItem, { link: link, onClick: state.megaMenu === 'open' ? onClose : undefined, activeItem: activeItem }),
                    index === 0 && (React.createElement(IconButton, { className: styles.dockMenuButton, tooltip: state.megaMenu === 'docked'
                            ? t('navigation.megamenu.undock', 'Undock menu')
                            : t('navigation.megamenu.dock', 'Dock menu'), name: "web-section-alt", onClick: handleDockedMenu, variant: "secondary" }))))))))));
}));
MegaMenu.displayName = 'MegaMenu';
const getStyles = (theme) => ({
    content: css({
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
        position: 'relative',
    }),
    mobileHeader: css({
        display: 'flex',
        justifyContent: 'space-between',
        padding: theme.spacing(1, 1, 1, 2),
        borderBottom: `1px solid ${theme.colors.border.weak}`,
        [theme.breakpoints.up('md')]: {
            display: 'none',
        },
    }),
    itemList: css({
        display: 'flex',
        flexDirection: 'column',
        listStyleType: 'none',
        minWidth: MENU_WIDTH,
        [theme.breakpoints.up('md')]: {
            width: MENU_WIDTH,
        },
    }),
    dockMenuButton: css({
        display: 'none',
        marginRight: theme.spacing(2),
        [theme.breakpoints.up('md')]: {
            display: 'inline-flex',
        },
    }),
});
//# sourceMappingURL=MegaMenu.js.map