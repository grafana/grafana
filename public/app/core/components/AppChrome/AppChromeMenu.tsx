import { css } from '@emotion/css';
import { useDialog } from '@react-aria/dialog';
import { FocusScope } from '@react-aria/focus';
import { OverlayContainer, useOverlay } from '@react-aria/overlays';
import React, { useRef } from 'react';
import CSSTransition from 'react-transition-group/CSSTransition';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2, useTheme2 } from '@grafana/ui';
import { useGrafana } from 'app/core/context/GrafanaContext';
import { KioskMode } from 'app/types';

import { MegaMenu, MENU_WIDTH } from './MegaMenu/MegaMenu';
import { TOGGLE_BUTTON_ID } from './NavToolbar/NavToolbar';
import { TOP_BAR_LEVEL_HEIGHT } from './types';

interface Props {}

export function AppChromeMenu({}: Props) {
  const theme = useTheme2();
  const { chrome } = useGrafana();
  const state = chrome.useState();
  const searchBarHidden = state.searchBarHidden || state.kioskMode === KioskMode.TV;

  const ref = useRef(null);
  const backdropRef = useRef(null);
  const animationSpeed = theme.transitions.duration.shortest;
  const animationStyles = useStyles2(getAnimStyles, animationSpeed);

  const isOpen = state.megaMenuOpen && !state.megaMenuDocked;
  const onClose = () => chrome.setMegaMenuOpen(false);

  const { overlayProps, underlayProps } = useOverlay(
    {
      isDismissable: true,
      isOpen: true,
      onClose,
      shouldCloseOnInteractOutside: (element) => {
        // don't close when clicking on the menu toggle, let the toggle button handle that
        // this prevents some nasty flickering when the menu is open and the toggle button is clicked
        const isMenuToggle = document.getElementById(TOGGLE_BUTTON_ID)?.contains(element);
        return !isMenuToggle;
      },
    },
    ref
  );
  const { dialogProps } = useDialog({}, ref);
  const styles = useStyles2(getStyles, searchBarHidden);

  return (
    <div className={styles.wrapper}>
      <OverlayContainer>
        <CSSTransition
          nodeRef={ref}
          in={isOpen}
          unmountOnExit={true}
          classNames={animationStyles.overlay}
          timeout={{ enter: animationSpeed, exit: 0 }}
        >
          <FocusScope contain autoFocus restoreFocus>
            <MegaMenu className={styles.menu} onClose={onClose} ref={ref} {...overlayProps} {...dialogProps} />
          </FocusScope>
        </CSSTransition>
        <CSSTransition
          nodeRef={backdropRef}
          in={isOpen}
          unmountOnExit={true}
          classNames={animationStyles.backdrop}
          timeout={{ enter: animationSpeed, exit: 0 }}
        >
          <div ref={backdropRef} className={styles.backdrop} {...underlayProps} />
        </CSSTransition>
      </OverlayContainer>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2, searchBarHidden?: boolean) => {
  const topPosition = searchBarHidden ? TOP_BAR_LEVEL_HEIGHT : TOP_BAR_LEVEL_HEIGHT * 2;

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
    menu: css({
      display: 'flex',
      bottom: 0,
      flexDirection: 'column',
      left: 0,
      right: 0,
      // Needs to below navbar should we change the navbarFixed? add add a new level?
      zIndex: theme.zIndex.modal,
      position: 'fixed',
      top: searchBarHidden ? 0 : TOP_BAR_LEVEL_HEIGHT,
      backgroundColor: theme.colors.background.primary,
      boxSizing: 'content-box',
      flex: '1 1 0',

      [theme.breakpoints.up('md')]: {
        right: 'unset',
        borderRight: `1px solid ${theme.colors.border.weak}`,
        top: topPosition,
      },
    }),
    wrapper: css({
      position: 'fixed',
      display: 'grid',
      gridAutoFlow: 'column',
      height: '100%',
      zIndex: theme.zIndex.sidemenu,
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
