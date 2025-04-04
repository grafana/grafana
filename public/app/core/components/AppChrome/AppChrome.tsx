import { css, cx } from '@emotion/css';
import classNames from 'classnames';
import { PropsWithChildren, useEffect } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { locationSearchToObject, locationService, useScopes } from '@grafana/runtime';
import { LinkButton, useStyles2, useTheme2 } from '@grafana/ui';
import { useGrafana } from 'app/core/context/GrafanaContext';
import { useMediaQueryChange } from 'app/core/hooks/useMediaQueryChange';
import { Trans } from 'app/core/internationalization';
import store from 'app/core/store';
import { CommandPalette } from 'app/features/commandPalette/CommandPalette';
import { ScopesDashboards } from 'app/features/scopes/dashboards/ScopesDashboards';

import { AppChromeMenu } from './AppChromeMenu';
import { DOCKED_LOCAL_STORAGE_KEY, DOCKED_MENU_OPEN_LOCAL_STORAGE_KEY } from './AppChromeService';
import { EXTENSION_SIDEBAR_WIDTH, ExtensionSidebar } from './ExtensionSidebar/ExtensionSidebar';
import { useExtensionSidebarContext } from './ExtensionSidebar/ExtensionSidebarProvider';
import { MegaMenu, MENU_WIDTH } from './MegaMenu/MegaMenu';
import { useMegaMenuFocusHelper } from './MegaMenu/utils';
import { ReturnToPrevious } from './ReturnToPrevious/ReturnToPrevious';
import { SingleTopBar } from './TopBar/SingleTopBar';
import { SingleTopBarActions } from './TopBar/SingleTopBarActions';
import { TOP_BAR_LEVEL_HEIGHT } from './types';

export interface Props extends PropsWithChildren<{}> {}

export function AppChrome({ children }: Props) {
  const { chrome } = useGrafana();
  const { isOpen: isExtensionSidebarOpen, isEnabled: isExtensionSidebarEnabled } = useExtensionSidebarContext();
  const state = chrome.useState();
  const theme = useTheme2();
  const scopes = useScopes();

  const dockedMenuBreakpoint = theme.breakpoints.values.xl;
  const dockedMenuLocalStorageState = store.getBool(DOCKED_LOCAL_STORAGE_KEY, true);
  const menuDockedAndOpen = !state.chromeless && state.megaMenuDocked && state.megaMenuOpen;
  const isScopesDashboardsOpen = Boolean(
    scopes?.state.enabled && scopes?.state.drawerOpened && !scopes?.state.readOnly
  );
  const styles = useStyles2(getStyles, Boolean(state.actions) || !!scopes?.state.enabled);
  useMediaQueryChange({
    breakpoint: dockedMenuBreakpoint,
    onChange: (e) => {
      if (dockedMenuLocalStorageState) {
        chrome.setMegaMenuDocked(e.matches, false);
        chrome.setMegaMenuOpen(
          e.matches ? store.getBool(DOCKED_MENU_OPEN_LOCAL_STORAGE_KEY, state.megaMenuOpen) : false
        );
      }
    },
  });
  useMegaMenuFocusHelper(state.megaMenuOpen, state.megaMenuDocked);

  const contentClass = cx({
    [styles.content]: true,
    [styles.contentChromeless]: state.chromeless,
    [styles.contentWithSidebar]: isExtensionSidebarOpen && !state.chromeless,
  });

  const handleMegaMenu = () => {
    chrome.setMegaMenuOpen(!state.megaMenuOpen);
  };

  const { pathname, search } = locationService.getLocation();
  const url = pathname + search;
  const shouldShowReturnToPrevious = state.returnToPrevious && url !== state.returnToPrevious.href;

  // Clear returnToPrevious when the page is manually navigated to
  useEffect(() => {
    if (state.returnToPrevious && url === state.returnToPrevious.href) {
      chrome.clearReturnToPrevious('auto_dismissed');
    }
    // We only want to pay attention when the location changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chrome, url]);

  // Sync updates from kiosk mode query string back into app chrome
  useEffect(() => {
    const queryParams = locationSearchToObject(search);
    chrome.setKioskModeFromUrl(queryParams.kiosk);
  }, [chrome, search]);

  // Chromeless routes are without topNav, mega menu, search & command palette
  // We check chromeless twice here instead of having a separate path so {children}
  // doesn't get re-mounted when chromeless goes from true to false.
  return (
    <div
      className={classNames('main-view', {
        'main-view--chrome-hidden': state.chromeless,
      })}
    >
      {!state.chromeless && (
        <>
          <LinkButton className={styles.skipLink} href="#pageContent">
            <Trans i18nKey="app-chrome.skip-content-button">Skip to main content</Trans>
          </LinkButton>
          {menuDockedAndOpen && (
            <MegaMenu className={styles.dockedMegaMenu} onClose={() => chrome.setMegaMenuOpen(false)} />
          )}
          <header className={cx(styles.topNav, menuDockedAndOpen && styles.topNavMenuDocked)}>
            <SingleTopBar
              sectionNav={state.sectionNav.node}
              pageNav={state.pageNav}
              onToggleMegaMenu={handleMegaMenu}
              onToggleKioskMode={chrome.onToggleKioskMode}
            />
            {(state.actions || scopes?.state.enabled) && <SingleTopBarActions>{state.actions}</SingleTopBarActions>}
          </header>
        </>
      )}
      <div className={contentClass}>
        <div className={cx(styles.panes, { [styles.panesWithSidebar]: isExtensionSidebarOpen })}>
          {!state.chromeless && (
            <div
              className={cx(styles.scopesDashboardsContainer, {
                [styles.scopesDashboardsContainerDocked]: menuDockedAndOpen,
              })}
            >
              <ScopesDashboards />
            </div>
          )}
          <main
            className={cx(styles.pageContainer, {
              [styles.pageContainerMenuDocked]: menuDockedAndOpen || isScopesDashboardsOpen,
              [styles.pageContainerMenuDockedScopes]: menuDockedAndOpen && isScopesDashboardsOpen,
              [styles.pageContainerWithSidebar]: !state.chromeless && isExtensionSidebarOpen,
            })}
            id="pageContent"
          >
            {children}
          </main>
          {!state.chromeless && isExtensionSidebarEnabled && isExtensionSidebarOpen && (
            <div className={styles.sidebarContainer}>
              <ExtensionSidebar />
            </div>
          )}
        </div>
      </div>
      {!state.chromeless && !state.megaMenuDocked && <AppChromeMenu />}
      {!state.chromeless && <CommandPalette />}
      {shouldShowReturnToPrevious && state.returnToPrevious && (
        <ReturnToPrevious href={state.returnToPrevious.href} title={state.returnToPrevious.title} />
      )}
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2, hasActions: boolean) => {
  return {
    content: css({
      display: 'flex',
      flexDirection: 'column',
      paddingTop: hasActions ? TOP_BAR_LEVEL_HEIGHT * 2 : TOP_BAR_LEVEL_HEIGHT,
      flexGrow: 1,
      height: 'auto',
    }),
    contentWithSidebar: css({
      height: '100vh',
      overflow: 'hidden',
    }),
    contentChromeless: css({
      paddingTop: 0,
    }),
    dockedMegaMenu: css({
      background: theme.colors.background.primary,
      borderRight: `1px solid ${theme.colors.border.weak}`,
      display: 'none',
      height: '100%',
      position: 'fixed',
      top: 0,
      width: MENU_WIDTH,
      zIndex: 2,

      [theme.breakpoints.up('xl')]: {
        display: 'block',
      },
    }),
    scopesDashboardsContainer: css({
      position: 'fixed',
      height: `calc(100% - ${TOP_BAR_LEVEL_HEIGHT}px)`,
      zIndex: 1,
    }),
    scopesDashboardsContainerDocked: css({
      left: MENU_WIDTH,
    }),
    topNav: css({
      display: 'flex',
      position: 'fixed',
      zIndex: theme.zIndex.navbarFixed,
      left: 0,
      right: 0,
      background: theme.colors.background.primary,
      flexDirection: 'column',
    }),
    topNavMenuDocked: css({
      left: MENU_WIDTH,
    }),
    panes: css({
      display: 'flex',
      flexDirection: 'column',
      flexGrow: 1,
      label: 'page-panes',
    }),
    panesWithSidebar: css({
      height: '100%',
      overflow: 'hidden',
      position: 'relative',
    }),
    pageContainerMenuDocked: css({
      paddingLeft: MENU_WIDTH,
    }),
    pageContainerMenuDockedScopes: css({
      paddingLeft: `calc(${MENU_WIDTH} * 2)`,
    }),
    pageContainer: css({
      label: 'page-container',
      display: 'flex',
      flexDirection: 'column',
      flexGrow: 1,
    }),
    pageContainerWithSidebar: css({
      overflow: 'auto',
      height: '100%',
      minHeight: 0,
      maxWidth: `calc(100% - ${EXTENSION_SIDEBAR_WIDTH})`,
    }),
    skipLink: css({
      position: 'fixed',
      top: -1000,

      ':focus': {
        left: theme.spacing(1),
        top: theme.spacing(1),
        zIndex: theme.zIndex.portal,
      },
    }),
    sidebarContainer: css({
      position: 'fixed',
      height: `calc(100% - ${TOP_BAR_LEVEL_HEIGHT}px)`,
      zIndex: 2,
      right: 0,
    }),
  };
};
