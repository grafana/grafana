import { css } from '@emotion/css';
import { useDialog } from '@react-aria/dialog';
import { FocusScope } from '@react-aria/focus';
import { OverlayContainer, useOverlay } from '@react-aria/overlays';
import React, { useEffect, useRef, useState } from 'react';
import CSSTransition from 'react-transition-group/CSSTransition';

import { GrafanaTheme2, NavModelItem } from '@grafana/data';
import { reportInteraction } from '@grafana/runtime';
import { CustomScrollbar, Icon, IconButton, useTheme2 } from '@grafana/ui';
import { useGrafana } from 'app/core/context/GrafanaContext';

import { TOP_BAR_LEVEL_HEIGHT } from '../AppChrome/types';
import { NavItem } from '../NavBar/NavBarMenu';
import { NavBarToggle } from '../NavBar/NavBarToggle';

const MENU_WIDTH = '350px';

export interface Props {
  activeItem?: NavModelItem;
  navItems: NavModelItem[];
  searchBarHidden?: boolean;
  onClose: () => void;
}

export function NavBarMenu({ activeItem, navItems, searchBarHidden, onClose }: Props) {
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

  const { overlayProps, underlayProps } = useOverlay(
    {
      isDismissable: true,
      isOpen: true,
      onClose: onMenuClose,
    },
    ref
  );

  useEffect(() => {
    if (state.megaMenuOpen) {
      setIsOpen(true);
    }
  }, [state.megaMenuOpen]);

  return (
    <OverlayContainer>
      <CSSTransition
        in={isOpen}
        unmountOnExit={true}
        classNames={animStyles.overlay}
        timeout={animationSpeed}
        onExited={onClose}
      >
        <div data-testid="navbarmenu" ref={ref} {...overlayProps} {...dialogProps} className={styles.container}>
          <FocusScope contain autoFocus>
            <div className={styles.mobileHeader}>
              <Icon name="bars" size="xl" />
              <IconButton
                aria-label="Close navigation menu"
                name="times"
                onClick={onMenuClose}
                size="xl"
                variant="secondary"
              />
            </div>
            <NavBarToggle
              className={styles.menuCollapseIcon}
              isExpanded={true}
              onClick={() => {
                reportInteraction('grafana_navigation_collapsed');
                onMenuClose();
              }}
            />
            <nav className={styles.content}>
              <CustomScrollbar showScrollIndicators hideHorizontalTrack>
                <ul className={styles.itemList}>
                  {navItems.map((link) => (
                    <NavItem link={link} onClose={onMenuClose} activeItem={activeItem} key={link.text} />
                  ))}
                </ul>
              </CustomScrollbar>
            </nav>
          </FocusScope>
        </div>
      </CSSTransition>
      <CSSTransition in={isOpen} unmountOnExit={true} classNames={animStyles.backdrop} timeout={animationSpeed}>
        <div ref={backdropRef} className={styles.backdrop} {...underlayProps} />
      </CSSTransition>
    </OverlayContainer>
  );
}

NavBarMenu.displayName = 'NavBarMenu';

const getStyles = (theme: GrafanaTheme2, searchBarHidden?: boolean) => {
  const topPosition = (searchBarHidden ? TOP_BAR_LEVEL_HEIGHT : TOP_BAR_LEVEL_HEIGHT * 2) + 1;

  return {
    backdrop: css({
      backdropFilter: 'blur(1px)',
      backgroundColor: theme.components.overlay.background,
      bottom: 0,
      left: 0,
      position: 'fixed',
      right: 0,
      top: topPosition,
      zIndex: theme.zIndex.navbarFixed - 2,
    }),
    container: css({
      display: 'flex',
      bottom: 0,
      flexDirection: 'column',
      left: 0,
      paddingTop: theme.spacing(1),
      marginRight: theme.spacing(1.5),
      right: 0,
      // Needs to below navbar should we change the navbarFixed? add add a new level?
      zIndex: theme.zIndex.navbarFixed - 1,
      position: 'fixed',
      top: topPosition,
      backgroundColor: theme.colors.background.primary,
      boxSizing: 'content-box',
      [theme.breakpoints.up('md')]: {
        borderRight: `1px solid ${theme.colors.border.weak}`,
        right: 'unset',
      },
    }),
    content: css({
      display: 'flex',
      flexDirection: 'column',
      overflow: 'auto',
    }),
    mobileHeader: css({
      borderBottom: `1px solid ${theme.colors.border.weak}`,
      display: 'flex',
      justifyContent: 'space-between',
      padding: theme.spacing(1, 2, 2),
      [theme.breakpoints.up('md')]: {
        display: 'none',
      },
    }),
    itemList: css({
      display: 'grid',
      gridAutoRows: `minmax(${theme.spacing(6)}, auto)`,
      minWidth: MENU_WIDTH,
    }),
    menuCollapseIcon: css({
      position: 'absolute',
      top: '43px',
      right: '0px',
      transform: `translateX(50%)`,
    }),
  };
};

const getAnimStyles = (theme: GrafanaTheme2, animationDuration: number) => {
  const commonTransition = {
    transitionDuration: `${animationDuration}ms`,
    transitionTimingFunction: theme.transitions.easing.easeInOut,
    [theme.breakpoints.down('md')]: {
      overflow: 'hidden',
    },
  };

  const overlayTransition = {
    ...commonTransition,
    transitionProperty: 'box-shadow, width',
    // this is needed to prevent a horizontal scrollbar during the animation on firefox
    '.scrollbar-view': {
      overflow: 'hidden !important',
    },
  };

  const backdropTransition = {
    ...commonTransition,
    transitionProperty: 'opacity',
  };

  const overlayOpen = {
    boxShadow: theme.shadows.z3,
    width: '100%',
    [theme.breakpoints.up('md')]: {
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
      exit: css(backdropOpen),
      exitActive: css(backdropTransition, backdropClosed),
    },
    overlay: {
      enter: css(overlayClosed),
      enterActive: css(overlayTransition, overlayOpen),
      enterDone: css(overlayOpen),
      exit: css(overlayOpen),
      exitActive: css(overlayTransition, overlayClosed),
    },
  };
};
