import { css, cx } from '@emotion/css';
import classNames from 'classnames';
import { PropsWithChildren, useEffect } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { config, locationSearchToObject, locationService } from '@grafana/runtime';
import { useStyles2, LinkButton, useTheme2 } from '@grafana/ui';
import { useGrafana } from 'app/core/context/GrafanaContext';
import { useMediaQueryChange } from 'app/core/hooks/useMediaQueryChange';
import { Trans } from 'app/core/internationalization';
import store from 'app/core/store';
import { CommandPalette } from 'app/features/commandPalette/CommandPalette';
import { ScopesDashboards, useScopesDashboardsState } from 'app/features/scopes';
import { KioskMode } from 'app/types';

import { AppChromeMenu } from './AppChromeMenu';
import { DOCKED_LOCAL_STORAGE_KEY, DOCKED_MENU_OPEN_LOCAL_STORAGE_KEY } from './AppChromeService';
import { MegaMenu, MENU_WIDTH } from './MegaMenu/MegaMenu';
import { useMegaMenuFocusHelper } from './MegaMenu/utils';
import { NavToolbar } from './NavToolbar/NavToolbar';
import { ReturnToPrevious } from './ReturnToPrevious/ReturnToPrevious';
import { SingleTopBar } from './TopBar/SingleTopBar';
import { SingleTopBarActions } from './TopBar/SingleTopBarActions';
import { TopSearchBar } from './TopBar/TopSearchBar';
import { TOP_BAR_LEVEL_HEIGHT } from './types';

export interface Props extends PropsWithChildren<{}> {}

export function AppChrome({ children }: Props) {
  const { chrome } = useGrafana();
  const state = chrome.useState();
  const searchBarHidden = state.searchBarHidden || state.kioskMode === KioskMode.TV;
  const theme = useTheme2();
  const styles = useStyles2(getStyles, searchBarHidden, Boolean(state.actions));

  const dockedMenuBreakpoint = theme.breakpoints.values.xl;
  const dockedMenuLocalStorageState = store.getBool(DOCKED_LOCAL_STORAGE_KEY, true);
  const menuDockedAndOpen = !state.chromeless && state.megaMenuDocked && state.megaMenuOpen;
  const scopesDashboardsState = useScopesDashboardsState();
  const isScopesDashboardsOpen = Boolean(
    scopesDashboardsState?.isEnabled && scopesDashboardsState?.isPanelOpened && !scopesDashboardsState?.isReadOnly
  );
  const isSingleTopNav = config.featureToggles.singleTopNav;
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
    [styles.contentNoSearchBar]: searchBarHidden,
    [styles.contentChromeless]: state.chromeless,
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
        'main-view--search-bar-hidden': searchBarHidden && !state.chromeless,
        'main-view--chrome-hidden': state.chromeless,
      })}
    >
      {!state.chromeless && (
        <>
          <LinkButton className={styles.skipLink} href="#pageContent">
            <Trans i18nKey="app-chrome.skip-content-button">Skip to main content</Trans>
          </LinkButton>
          {isSingleTopNav && menuDockedAndOpen && (
            <MegaMenu className={styles.dockedMegaMenu} onClose={() => chrome.setMegaMenuOpen(false)} />
          )}
          <header className={cx(styles.topNav, isSingleTopNav && menuDockedAndOpen && styles.topNavMenuDocked)}>
            {isSingleTopNav ? (
              <>
                <SingleTopBar
                  sectionNav={state.sectionNav.node}
                  pageNav={state.pageNav}
                  onToggleMegaMenu={handleMegaMenu}
                  onToggleKioskMode={chrome.onToggleKioskMode}
                />
                {state.actions && <SingleTopBarActions>{state.actions}</SingleTopBarActions>}
              </>
            ) : (
              <>
                {!searchBarHidden && <TopSearchBar />}
                <NavToolbar
                  searchBarHidden={searchBarHidden}
                  sectionNav={state.sectionNav.node}
                  pageNav={state.pageNav}
                  actions={state.actions}
                  onToggleSearchBar={chrome.onToggleSearchBar}
                  onToggleMegaMenu={handleMegaMenu}
                  onToggleKioskMode={chrome.onToggleKioskMode}
                />
              </>
            )}
          </header>
        </>
      )}
      <div className={contentClass}>
        <div className={styles.panes}>
          {!isSingleTopNav && menuDockedAndOpen && (
            <MegaMenu className={styles.dockedMegaMenu} onClose={() => chrome.setMegaMenuOpen(false)} />
          )}
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
            })}
            id="pageContent"
          >
            {children}
          </main>
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

const getStyles = (theme: GrafanaTheme2, searchBarHidden: boolean, hasActions: boolean) => {
  const isSingleTopNav = config.featureToggles.singleTopNav;
  return {
    content: css({
      display: 'flex',
      flexDirection: 'column',
      paddingTop: !isSingleTopNav || hasActions ? TOP_BAR_LEVEL_HEIGHT * 2 : TOP_BAR_LEVEL_HEIGHT,
      flexGrow: 1,
      height: 'auto',
    }),
    contentNoSearchBar: css({
      paddingTop: TOP_BAR_LEVEL_HEIGHT,
    }),
    contentChromeless: css({
      paddingTop: 0,
    }),
    dockedMegaMenu: css(
      {
        background: theme.colors.background.primary,
        borderRight: `1px solid ${theme.colors.border.weak}`,
        display: 'none',
        width: MENU_WIDTH,

        [theme.breakpoints.up('xl')]: {
          display: 'block',
        },
      },
      {
        position: 'fixed',
        height: `calc(100% - ${searchBarHidden ? TOP_BAR_LEVEL_HEIGHT : TOP_BAR_LEVEL_HEIGHT * 2}px)`,
        zIndex: 2,
      },
      isSingleTopNav && {
        height: '100%',
        top: 0,
      }
    ),
    scopesDashboardsContainer: css({
      position: 'fixed',
      height: `calc(100% - ${searchBarHidden || isSingleTopNav ? TOP_BAR_LEVEL_HEIGHT : TOP_BAR_LEVEL_HEIGHT * 2}px)`,
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
    skipLink: css({
      position: 'fixed',
      top: -1000,

      ':focus': {
        left: theme.spacing(1),
        top: theme.spacing(1),
        zIndex: theme.zIndex.portal,
      },
    }),
  };
};
