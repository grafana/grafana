import { css } from '@emotion/css';
import { useDialog } from '@react-aria/dialog';
import { FocusScope } from '@react-aria/focus';
import { OverlayContainer, useOverlay } from '@react-aria/overlays';
import React, { useEffect, useRef, useState } from 'react';
import CSSTransition from 'react-transition-group/CSSTransition';
import { CustomScrollbar, Icon, IconButton, useTheme2 } from '@grafana/ui';
import { useGrafana } from 'app/core/context/GrafanaContext';
import { TOP_BAR_LEVEL_HEIGHT } from '../types';
import { NavBarMenuItemWrapper } from './NavBarMenuItemWrapper';
const MENU_WIDTH = '350px';
export function NavBarMenu({ activeItem, navItems, searchBarHidden, onClose }) {
    const theme = useTheme2();
    const styles = getStyles(theme, searchBarHidden);
    const animationSpeed = theme.transitions.duration.shortest;
    const animStyles = getAnimStyles(theme, animationSpeed);
    const { chrome } = useGrafana();
    const state = chrome.useState();
    const ref = useRef(null);
    const backdropRef = useRef(null);
    const { dialogProps } = useDialog({}, ref);
    const [isOpen, setIsOpen] = useState(false);
    const onMenuClose = () => setIsOpen(false);
    const { overlayProps, underlayProps } = useOverlay({
        isDismissable: true,
        isOpen: true,
        onClose: onMenuClose,
    }, ref);
    useEffect(() => {
        if (state.megaMenu === 'open') {
            setIsOpen(true);
        }
    }, [state.megaMenu]);
    return (React.createElement(OverlayContainer, null,
        React.createElement(CSSTransition, { nodeRef: ref, in: isOpen, unmountOnExit: true, classNames: animStyles.overlay, timeout: { enter: animationSpeed, exit: 0 }, onExited: onClose },
            React.createElement(FocusScope, { contain: true, autoFocus: true },
                React.createElement("div", Object.assign({ "data-testid": "navbarmenu", ref: ref }, overlayProps, dialogProps, { className: styles.container }),
                    React.createElement("div", { className: styles.mobileHeader },
                        React.createElement(Icon, { name: "bars", size: "xl" }),
                        React.createElement(IconButton, { "aria-label": "Close navigation menu", tooltip: "Close menu", name: "times", onClick: onMenuClose, size: "xl", variant: "secondary" })),
                    React.createElement("nav", { className: styles.content },
                        React.createElement(CustomScrollbar, { showScrollIndicators: true, hideHorizontalTrack: true },
                            React.createElement("ul", { className: styles.itemList }, navItems.map((link) => (React.createElement(NavBarMenuItemWrapper, { link: link, onClose: onMenuClose, activeItem: activeItem, key: link.text }))))))))),
        React.createElement(CSSTransition, { nodeRef: backdropRef, in: isOpen, unmountOnExit: true, classNames: animStyles.backdrop, timeout: { enter: animationSpeed, exit: 0 } },
            React.createElement("div", Object.assign({ ref: backdropRef, className: styles.backdrop }, underlayProps)))));
}
NavBarMenu.displayName = 'NavBarMenu';
const getStyles = (theme, searchBarHidden) => {
    const topPosition = (searchBarHidden ? TOP_BAR_LEVEL_HEIGHT : TOP_BAR_LEVEL_HEIGHT * 2) + 1;
    return {
        backdrop: css({
            backdropFilter: 'blur(1px)',
            backgroundColor: theme.components.overlay.background,
            bottom: 0,
            left: 0,
            position: 'fixed',
            right: 0,
            top: searchBarHidden ? 0 : TOP_BAR_LEVEL_HEIGHT,
            zIndex: theme.zIndex.modalBackdrop,
            [theme.breakpoints.up('md')]: {
                top: topPosition,
            },
        }),
        container: css({
            display: 'flex',
            bottom: 0,
            flexDirection: 'column',
            left: 0,
            marginRight: theme.spacing(1.5),
            right: 0,
            // Needs to below navbar should we change the navbarFixed? add add a new level?
            zIndex: theme.zIndex.modal,
            position: 'fixed',
            top: searchBarHidden ? 0 : TOP_BAR_LEVEL_HEIGHT,
            backgroundColor: theme.colors.background.primary,
            boxSizing: 'content-box',
            flex: '1 1 0',
            [theme.breakpoints.up('md')]: {
                borderRight: `1px solid ${theme.colors.border.weak}`,
                right: 'unset',
                top: topPosition,
            },
        }),
        content: css({
            display: 'flex',
            flexDirection: 'column',
            flexGrow: 1,
            minHeight: 0,
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
            display: 'grid',
            gridAutoRows: `minmax(${theme.spacing(6)}, auto)`,
            gridTemplateColumns: `minmax(${MENU_WIDTH}, auto)`,
            minWidth: MENU_WIDTH,
        }),
    };
};
const getAnimStyles = (theme, animationDuration) => {
    const commonTransition = {
        transitionDuration: `${animationDuration}ms`,
        transitionTimingFunction: theme.transitions.easing.easeInOut,
        [theme.breakpoints.down('md')]: {
            overflow: 'hidden',
        },
    };
    const overlayTransition = Object.assign(Object.assign({}, commonTransition), { transitionProperty: 'box-shadow, width', 
        // this is needed to prevent a horizontal scrollbar during the animation on firefox
        '.scrollbar-view': {
            overflow: 'hidden !important',
        } });
    const backdropTransition = Object.assign(Object.assign({}, commonTransition), { transitionProperty: 'opacity' });
    const overlayOpen = {
        width: '100%',
        [theme.breakpoints.up('md')]: {
            boxShadow: theme.shadows.z3,
            width: MENU_WIDTH,
        },
    };
    const overlayClosed = {
        boxShadow: 'none',
        width: 0,
    };
    const backdropOpen = {
        opacity: 1,
    };
    const backdropClosed = {
        opacity: 0,
    };
    return {
        backdrop: {
            enter: css(backdropClosed),
            enterActive: css(backdropTransition, backdropOpen),
            enterDone: css(backdropOpen),
        },
        overlay: {
            enter: css(overlayClosed),
            enterActive: css(overlayTransition, overlayOpen),
            enterDone: css(overlayOpen),
        },
    };
};
//# sourceMappingURL=NavBarMenu.js.map