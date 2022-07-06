import { css } from '@emotion/css';
import { useDialog } from '@react-aria/dialog';
import { FocusScope } from '@react-aria/focus';
import { OverlayContainer, useOverlay } from '@react-aria/overlays';
import React, { useRef } from 'react';
import CSSTransition from 'react-transition-group/CSSTransition';

import { GrafanaTheme2, NavModelItem } from '@grafana/data';
import { reportInteraction } from '@grafana/runtime';
import { CustomScrollbar, Icon, IconButton, useTheme2 } from '@grafana/ui';

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
  const ref = useRef(null);
  const { dialogProps } = useDialog({}, ref);

  const { overlayProps, underlayProps } = useOverlay(
    {
      isDismissable: true,
      isOpen: true,
      onClose,
    },
    ref
  );

  return (
    <OverlayContainer>
      <FocusScope contain autoFocus>
        <CSSTransition appear={true} in={true} classNames={animStyles.overlay} timeout={animationSpeed}>
          <div data-testid="navbarmenu" ref={ref} {...overlayProps} {...dialogProps} className={styles.container}>
            <div className={styles.mobileHeader}>
              <Icon name="bars" size="xl" />
              <IconButton
                aria-label="Close navigation menu"
                name="times"
                onClick={onClose}
                size="xl"
                variant="secondary"
              />
            </div>
            <NavBarToggle
              className={styles.menuCollapseIcon}
              isExpanded={true}
              onClick={() => {
                reportInteraction('grafana_navigation_collapsed');
                onClose();
              }}
            />
            <nav className={styles.content}>
              <CustomScrollbar hideHorizontalTrack>
                <ul className={styles.itemList}>
                  {navItems.map((link) => (
                    <NavItem link={link} onClose={onClose} activeItem={activeItem} key={link.text} />
                  ))}
                </ul>
              </CustomScrollbar>
            </nav>
          </div>
        </CSSTransition>
        <CSSTransition appear={true} in={true} classNames={animStyles.backdrop} timeout={animationSpeed}>
          <div className={styles.backdrop} {...underlayProps} />
        </CSSTransition>
      </FocusScope>
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
    transitionProperty: 'background-color, box-shadow, width',
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
    backgroundColor: theme.colors.background.primary,
    boxShadow: theme.shadows.z3,
    width: '100%',
    [theme.breakpoints.up('md')]: {
      width: MENU_WIDTH,
    },
  };

  const overlayClosed = {
    boxShadow: 'none',
    width: 0,
    [theme.breakpoints.up('md')]: {
      backgroundColor: theme.colors.background.primary,
      width: theme.spacing(7),
    },
  };

  const backdropOpen = {
    opacity: 1,
  };

  const backdropClosed = {
    opacity: 0,
  };

  return {
    backdrop: {
      appear: css(backdropClosed),
      appearActive: css(backdropTransition, backdropOpen),
      appearDone: css(backdropOpen),
      exit: css(backdropOpen),
      exitActive: css(backdropTransition, backdropClosed),
    },
    overlay: {
      appear: css(overlayClosed),
      appearActive: css(overlayTransition, overlayOpen),
      appearDone: css(overlayOpen),
      exit: css(overlayOpen),
      exitActive: css(overlayTransition, overlayClosed),
    },
  };
};
