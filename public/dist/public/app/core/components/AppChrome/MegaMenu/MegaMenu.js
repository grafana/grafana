import { css } from '@emotion/css';
import { cloneDeep } from 'lodash';
import React from 'react';
import { useLocation } from 'react-router-dom';
import { useTheme2 } from '@grafana/ui';
import { useSelector } from 'app/types';
import { NavBarMenu } from './NavBarMenu';
import { enrichWithInteractionTracking, getActiveItem } from './utils';
export const MegaMenu = React.memo(({ onClose, searchBarHidden }) => {
    const navBarTree = useSelector((state) => state.navBarTree);
    const theme = useTheme2();
    const styles = getStyles(theme);
    const location = useLocation();
    const navTree = cloneDeep(navBarTree);
    // Remove profile + help from tree
    const navItems = navTree
        .filter((item) => item.id !== 'profile' && item.id !== 'help')
        .map((item) => enrichWithInteractionTracking(item, true));
    const activeItem = getActiveItem(navItems, location.pathname);
    return (React.createElement("div", { className: styles.menuWrapper },
        React.createElement(NavBarMenu, { activeItem: activeItem, navItems: navItems, onClose: onClose, searchBarHidden: searchBarHidden })));
});
MegaMenu.displayName = 'MegaMenu';
const getStyles = (theme) => ({
    menuWrapper: css({
        position: 'fixed',
        display: 'grid',
        gridAutoFlow: 'column',
        height: '100%',
        zIndex: theme.zIndex.sidemenu,
    }),
});
//# sourceMappingURL=MegaMenu.js.map