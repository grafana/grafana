import { css, cx } from '@emotion/css';
import { useDialog } from '@react-aria/dialog';
import { FocusScope } from '@react-aria/focus';
import { OverlayContainer, useOverlay } from '@react-aria/overlays';
import classNames from 'classnames';
import React, { PropsWithChildren, useRef, useState } from 'react';
import CSSTransition from 'react-transition-group/CSSTransition';

import { GrafanaTheme2, PageLayoutType } from '@grafana/data';
import { useStyles2, LinkButton, useTheme2 } from '@grafana/ui';
import config from 'app/core/config';
import { useGrafana } from 'app/core/context/GrafanaContext';
import { CommandPalette } from 'app/features/commandPalette/CommandPalette';
import { KioskMode } from 'app/types';

import { DockedMegaMenu } from './DockedMegaMenu/DockedMegaMenu';
import { MegaMenu } from './MegaMenu/MegaMenu';
import { NavToolbar } from './NavToolbar/NavToolbar';
import { SectionNav } from './SectionNav/SectionNav';
import { TopSearchBar } from './TopBar/TopSearchBar';
import { TOP_BAR_LEVEL_HEIGHT } from './types';

const MENU_WIDTH = '350px';

export interface Props extends PropsWithChildren<{}> {}

export function AppChrome({ children }: Props) {
  const styles = useStyles2(getStyles);
  const { chrome } = useGrafana();
  const state = chrome.useState();

  const searchBarHidden = state.searchBarHidden || state.kioskMode === KioskMode.TV;

  const contentClass = cx({
    [styles.content]: true,
    [styles.contentNoSearchBar]: searchBarHidden,
    [styles.contentChromeless]: state.chromeless,
  });

  const menuRef = useRef(null);
  const [menuIsOpen, setMenuIsOpen] = useState(false);
  const theme = useTheme2();
  const menuAnimationSpeed = theme.transitions.duration.shortest;
  const menuAnimStyles = getAnimStyles(theme, menuAnimationSpeed);
  const menuBackdropRef = useRef(null);
  const menuOnClose = () => chrome.setMegaMenu(false);
  const { overlayProps, underlayProps } = useOverlay(
    {
      isDismissable: true,
      isOpen: true,
      onClose: () => setMenuIsOpen(false),
    },
    menuRef
  );
  const { dialogProps } = useDialog({}, menuRef);

  // Chromeless routes are without topNav, mega menu, search & command palette
  // We check chromeless twice here instead of having a separate path so {children}
  // doesn't get re-mounted when chromeless goes from true to false.

  return (
    <div
      className={classNames('main-view', {
        'main-view--search-bar-hidden': searchBarHidden && !state.chromeless,
        'main-view--chrome-hidden': state.chromeless,
      })}
    >
      {!state.chromeless && (
        <>
          <LinkButton className={styles.skipLink} href="#pageContent">
            Skip to main content
          </LinkButton>
          <div className={cx(styles.topNav)}>
            {!searchBarHidden && <TopSearchBar />}
            <NavToolbar
              searchBarHidden={searchBarHidden}
              sectionNav={state.sectionNav.node}
              pageNav={state.pageNav}
              actions={state.actions}
              onToggleSearchBar={chrome.onToggleSearchBar}
              onToggleMegaMenu={chrome.onToggleMegaMenu}
              onToggleKioskMode={chrome.onToggleKioskMode}
            />
          </div>
        </>
      )}
      <main className={contentClass} id="pageContent">
        <div className={styles.panes}>
          {state.layout === PageLayoutType.Standard && state.sectionNav && !config.featureToggles.dockedMegaMenu && (
            <SectionNav model={state.sectionNav} />
          )}
          <div className={styles.pageContainer}>{children}</div>
        </div>
      </main>
      {!state.chromeless && (
        <>
          {config.featureToggles.dockedMegaMenu ? (
            <div className={styles.menuWrapper}>
              <OverlayContainer>
                <CSSTransition
                  nodeRef={menuRef}
                  in={menuIsOpen}
                  unmountOnExit={true}
                  classNames={menuAnimStyles.overlay}
                  timeout={{ enter: menuAnimationSpeed, exit: 0 }}
                  onExited={menuOnClose}
                >
                  <FocusScope contain autoFocus>
                    <DockedMegaMenu searchBarHidden={searchBarHidden} {...overlayProps} {...dialogProps}/>
                  </FocusScope>
                </CSSTransition>
                <CSSTransition
                  nodeRef={menuBackdropRef}
                  in={menuIsOpen}
                  unmountOnExit={true}
                  classNames={menuAnimStyles.backdrop}
                  timeout={{ enter: menuAnimationSpeed, exit: 0 }}
                >
                  <div ref={menuBackdropRef} className={styles.backdrop} {...underlayProps} />
                </CSSTransition>
              </OverlayContainer>
            </div>
          ) : (
            <MegaMenu searchBarHidden={searchBarHidden} onClose={() => chrome.setMegaMenu(false)} />
          )}
          <CommandPalette />
        </>
      )}
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  const shadow = theme.isDark
    ? `0 0.6px 1.5px rgb(0 0 0), 0 2px 4px rgb(0 0 0 / 40%), 0 5px 10px rgb(0 0 0 / 23%)`
    : '0 4px 8px rgb(0 0 0 / 4%)';

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
    menuWrapper: css({
      position: 'fixed',
      display: 'grid',
      gridAutoFlow: 'column',
      height: '100%',
      zIndex: theme.zIndex.sidemenu,
    }),
    content: css({
      display: 'flex',
      flexDirection: 'column',
      paddingTop: TOP_BAR_LEVEL_HEIGHT * 2,
      flexGrow: 1,
      height: '100%',
    }),
    contentNoSearchBar: css({
      paddingTop: TOP_BAR_LEVEL_HEIGHT,
    }),
    contentChromeless: css({
      paddingTop: 0,
    }),
    topNav: css({
      display: 'flex',
      position: 'fixed',
      zIndex: theme.zIndex.navbarFixed,
      left: 0,
      right: 0,
      boxShadow: shadow,
      background: theme.colors.background.primary,
      flexDirection: 'column',
      borderBottom: `1px solid ${theme.colors.border.weak}`,
    }),
    panes: css({
      label: 'page-panes',
      display: 'flex',
      height: '100%',
      width: '100%',
      flexGrow: 1,
      minHeight: 0,
      flexDirection: 'column',
      [theme.breakpoints.up('md')]: {
        flexDirection: 'row',
      },
    }),
    pageContainer: css({
      label: 'page-container',
      flexGrow: 1,
      minHeight: 0,
      minWidth: 0,
    }),
    skipLink: css({
      position: 'absolute',
      top: -1000,

      ':focus': {
        left: theme.spacing(1),
        top: theme.spacing(1),
        zIndex: theme.zIndex.portal,
      },
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
