import { css, cx } from '@emotion/css';
import { PropsWithChildren, useEffect } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { locationSearchToObject, locationService } from '@grafana/runtime';
import { useStyles2, LinkButton, useTheme2 } from '@grafana/ui';
import { useGrafana } from 'app/core/context/GrafanaContext';
import { useMediaQueryChange } from 'app/core/hooks/useMediaQueryChange';
import { Trans } from 'app/core/internationalization';
import store from 'app/core/store';
import { CommandPalette } from 'app/features/commandPalette/CommandPalette';
import { useScopesDashboardsState } from 'app/features/scopes';

import { AppNotificationList } from '../AppNotifications/AppNotificationList';

import { AppChromeMenu } from './AppChromeMenu';
import { DOCKED_LOCAL_STORAGE_KEY, DOCKED_MENU_OPEN_LOCAL_STORAGE_KEY } from './AppChromeService';
import { MegaMenu, MENU_WIDTH } from './MegaMenu/MegaMenu';
import { useMegaMenuFocusHelper } from './MegaMenu/utils';
import { ReturnToPrevious } from './ReturnToPrevious/ReturnToPrevious';
import { SingleTopBar } from './TopBar/SingleTopBar';
import { SingleTopBarActions } from './TopBar/SingleTopBarActions';

export interface Props extends PropsWithChildren<{}> {}

export function AppChrome({ children }: Props) {
  const { chrome } = useGrafana();
  const state = chrome.useState();
  const theme = useTheme2();
  const styles = useStyles2(getStyles, Boolean(state.actions));

  const dockedMenuBreakpoint = theme.breakpoints.values.xl;
  const dockedMenuLocalStorageState = store.getBool(DOCKED_LOCAL_STORAGE_KEY, true);
  const menuDockedAndOpen = !state.chromeless && state.megaMenuDocked && state.megaMenuOpen;
  const scopesDashboardsState = useScopesDashboardsState();
  const isScopesDashboardsOpen = Boolean(
    scopesDashboardsState?.isEnabled && scopesDashboardsState?.isPanelOpened && !scopesDashboardsState?.isReadOnly
  );
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

  // PR TODO:
  // - DashboardScopes was removed

  // Chromeless routes are without topNav, mega menu, search & command palette
  // We check chromeless twice here instead of having a separate path so {children}
  // doesn't get re-mounted when chromeless goes from true to false.
  return (
    <>
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

            {state.actions && <SingleTopBarActions>{state.actions}</SingleTopBarActions>}
          </header>
        </>
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

      <AppNotificationList />

      {!state.chromeless && !state.megaMenuDocked && <AppChromeMenu />}

      {!state.chromeless && <CommandPalette />}

      {shouldShowReturnToPrevious && state.returnToPrevious && (
        <ReturnToPrevious href={state.returnToPrevious.href} title={state.returnToPrevious.title} />
      )}
    </>
  );
}

const getStyles = (theme: GrafanaTheme2, hasActions: boolean) => {
  return {
    dockedMegaMenu: css({
      label: 'AppChrome-dockedMegaMenu',
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

    topNav: css({
      label: 'AppChrome-topNav',
      display: 'flex',
      position: 'sticky',
      zIndex: theme.zIndex.navbarFixed,
      top: 0,
      background: theme.colors.background.primary,
      flexDirection: 'column',
    }),

    topNavMenuDocked: css({
      label: 'AppChrome-topNavMenuDocked',
      left: MENU_WIDTH,
    }),

    pageContainerMenuDocked: css({
      label: 'AppChrome-pageContainerMenuDocked',
      paddingLeft: MENU_WIDTH,
    }),
    pageContainerMenuDockedScopes: css({
      label: 'AppChrome-pageContainerMenuDockedScopes',
      paddingLeft: `calc(${MENU_WIDTH} * 2)`,
    }),
    pageContainer: css({
      label: 'AppChrome-pageContainer',
      display: 'flex',
      flexDirection: 'column',
      flexGrow: 1,
    }),
    skipLink: css({
      label: 'AppChrome-skipLink',
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
