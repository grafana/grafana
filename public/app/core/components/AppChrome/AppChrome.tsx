import { css, cx } from '@emotion/css';
import { useBooleanFlagValue } from '@openfeature/react-sdk';
import classNames from 'clsx';
import { Resizable } from 're-resizable';
import { type PropsWithChildren, useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { type GrafanaTheme2, store } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { locationSearchToObject, locationService, useScopes } from '@grafana/runtime';
import { useFlagGrafanaVisualDesignRefresh } from '@grafana/runtime/internal';
import { ErrorBoundaryAlert, floatingUtils, getDragStyles, LinkButton, useStyles2 } from '@grafana/ui';
import { SplashScreenModal } from 'app/core/components/SplashScreenModal/SplashScreenModal';
import { useGrafana } from 'app/core/context/GrafanaContext';
import { useMediaQueryMinWidth } from 'app/core/hooks/useMediaQueryMinWidth';
import { CommandPalette } from 'app/features/commandPalette/CommandPalette';
import { ScopesDashboards } from 'app/features/scopes/dashboards/ScopesDashboards';

import { AppChromeMenu } from './AppChromeMenu';
import { type AppChromeService, DOCKED_LOCAL_STORAGE_KEY } from './AppChromeService';
import {
  ExtensionSidebar,
  MAX_EXTENSION_SIDEBAR_WIDTH,
  MIN_EXTENSION_SIDEBAR_WIDTH,
} from './ExtensionSidebar/ExtensionSidebar';
import { useExtensionSidebarContext } from './ExtensionSidebar/ExtensionSidebarProvider';
import { FeatureControlFloating } from './FeatureControl/FeatureControlFloating';
import { FullscreenWorkspacePlatformBar } from './FullscreenWorkspace/FullscreenWorkspacePlatformBar';
import { FullscreenWorkspaceShell } from './FullscreenWorkspace/FullscreenWorkspaceShell';
import { useFullscreenWorkspace } from './FullscreenWorkspace/useFullscreenWorkspace';
import { MegaMenu, MENU_WIDTH } from './MegaMenu/MegaMenu';
import { useMegaMenuFocusHelper } from './MegaMenu/utils';
import { ReturnToPrevious } from './ReturnToPrevious/ReturnToPrevious';
import { SingleTopBar } from './TopBar/SingleTopBar';
import { getChromeHeaderLevelHeight, useChromeHeaderLevels } from './TopBar/useChromeHeaderHeight';

export const EXTENSION_SIDEBAR_FLOATING_TESTID = 'extension-sidebar-floating';

export interface Props extends PropsWithChildren<{}> {}

export function AppChrome({ children }: Props) {
  const { chrome } = useGrafana();
  const visualRefreshEnabled = useFlagGrafanaVisualDesignRefresh();
  const {
    isOpen: isExtensionSidebarOpen,
    extensionSidebarWidth,
    setExtensionSidebarWidth,
  } = useExtensionSidebarContext();
  const state = chrome.useState();
  const scopes = useScopes();
  const isSplashScreenEnabled = useBooleanFlagValue('splashScreen', false);

  const { fullscreenWorkspaceActive, fullscreenWorkspaceFeatureFlagEnabled } = useFullscreenWorkspace();

  // The DOM node exposed by the fullscreen workspace Platform tab; the shell registers it.
  const [workspaceHost, setWorkspaceHost] = useState<HTMLElement | null>(null);

  // Only used when the fullscreen workspace feature is enabled: the live page (`children`) is
  // portaled into this one stable, detached node, so it mounts once and is never unmounted.
  // `portalHostRef` reparents that node into whichever host is active (the default <main> or the
  // workspace host), moving DOM without a remount/refetch. When the feature is disabled the page
  // renders directly inside <main> instead (original behavior, no portal), so we don't create it.
  const portalTargetRef = useRef<HTMLDivElement | null>(null);
  if (fullscreenWorkspaceFeatureFlagEnabled && !portalTargetRef.current) {
    portalTargetRef.current = document.createElement('div');
    // Keep the portal wrapper out of the box tree so `children` stays a direct flex child of its
    // host (<main> / workspace Platform tab) and the page's layout is unchanged.
    portalTargetRef.current.style.display = 'contents';
  }
  const portalHostRef = useCallback((host: HTMLElement | null) => {
    if (host && portalTargetRef.current) {
      host.appendChild(portalTargetRef.current);
    }
  }, []);

  const menuDockedAndOpen = !state.chromeless && state.megaMenuDocked && state.megaMenuOpen;
  const isScopesDashboardsOpen = Boolean(
    !state.chromeless && scopes?.state.enabled && scopes?.state.drawerOpened && !scopes?.state.readOnly
  );

  const headerLevels = useChromeHeaderLevels();
  const styles = useStyles2(getStyles, headerLevels, getChromeHeaderLevelHeight(), visualRefreshEnabled);
  const contentSizeStyles = useStyles2(getContentSizeStyles, extensionSidebarWidth);
  const dragStyles = useStyles2(getDragStyles);
  const isSmallScreen = !useMediaQueryMinWidth('sm');

  useResponsiveDockedMegaMenu(chrome);
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

  const fullscreenWorkspaceChrome = (
    <div id={floatingUtils.BOUNDARY_ELEMENT_ID}>
      <FullscreenWorkspaceShell workspaceHostRef={setWorkspaceHost} />
      {workspaceHost &&
        createPortal(
          <>
            {/* A slim bar (hamburger + breadcrumbs) sits above the live page inside the Platform tab */}
            <FullscreenWorkspacePlatformBar />
            {/* `display: contents` keeps this ref wrapper out of the box tree, so the portaled page
                stays a direct flex child of the workspace host (like it is of <main> in normal mode)
                and full-height pages (e.g. Explore) can fill the Platform tab instead of collapsing. */}
            <div ref={portalHostRef} className={styles.portalHost} />
          </>,
          workspaceHost
        )}
    </div>
  );

  // Chromeless routes are without topNav, mega menu, search & command palette
  // We check chromeless twice here instead of having a separate path so {children}
  // doesn't get re-mounted when chromeless goes from true to false.
  const defaultChrome = (
    <div
      id={floatingUtils.BOUNDARY_ELEMENT_ID}
      className={classNames('main-view', {
        'main-view--chrome-hidden': state.chromeless,
      })}
    >
      {!state.chromeless && (
        <>
          <LinkButton
            className={styles.skipLink}
            href="#pageContent"
            onClick={(e) => {
              e.preventDefault();
              document.getElementById('pageContent')?.focus();
            }}
          >
            <Trans i18nKey="app-chrome.skip-content-button">Skip to main content</Trans>
          </LinkButton>
          {menuDockedAndOpen && (
            <MegaMenu
              className={cx(styles.dockedMegaMenu, state.megaMenuCustomising && styles.dockedMegaMenuElevated)}
              onClose={() => chrome.setMegaMenuOpen(false)}
            />
          )}
          <header className={cx(styles.topNav, menuDockedAndOpen && styles.topNavMenuDocked)}>
            <SingleTopBar
              sectionNav={state.sectionNav.node}
              pageNav={state.pageNav}
              onToggleMegaMenu={handleMegaMenu}
              onToggleKioskMode={chrome.onToggleKioskMode}
              actions={state.actions}
              breadcrumbActions={state.breadcrumbActions}
              scopes={scopes}
              showToolbarLevel={headerLevels === 2}
            />
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
              <ErrorBoundaryAlert boundaryName="scopes-dashboards">
                <ScopesDashboards />
              </ErrorBoundaryAlert>
            </div>
          )}
          <main
            className={cx(styles.pageContainer, {
              [styles.pageContainerMenuDocked]: menuDockedAndOpen || isScopesDashboardsOpen,
              [styles.pageContainerMenuDockedScopes]: menuDockedAndOpen && isScopesDashboardsOpen,
              [styles.pageContainerWithSidebar]: !state.chromeless && isExtensionSidebarOpen,
              [contentSizeStyles.contentWidth]: !state.chromeless && isExtensionSidebarOpen && !isSmallScreen,
            })}
            id="pageContent"
            tabIndex={-1}
            ref={fullscreenWorkspaceFeatureFlagEnabled ? portalHostRef : undefined}
          >
            {!fullscreenWorkspaceFeatureFlagEnabled && children}
          </main>
          {!state.chromeless &&
            isExtensionSidebarOpen &&
            (isSmallScreen ? (
              <div className={styles.sidebarContainerFloating} data-testid={EXTENSION_SIDEBAR_FLOATING_TESTID}>
                <ExtensionSidebar />
              </div>
            ) : (
              <Resizable
                className={styles.sidebarContainer}
                defaultSize={{ width: extensionSidebarWidth }}
                enable={{ left: true }}
                onResize={(_evt, _direction, ref) => setExtensionSidebarWidth(ref.getBoundingClientRect().width)}
                handleClasses={{ left: dragStyles.dragHandleBaseVertical }}
                minWidth={MIN_EXTENSION_SIDEBAR_WIDTH}
                maxWidth={MAX_EXTENSION_SIDEBAR_WIDTH}
              >
                <ExtensionSidebar />
              </Resizable>
            ))}
        </div>
      </div>
      {/* De-emphasise and lock the page while customising the nav. Docked mode has no menu backdrop of
          its own, so this overlay provides it (undocked mode is already covered by the AppChromeMenu
          backdrop). It sits above the top bar and captures clicks so the rest of the page can't be
          interacted with mid-edit; leaving customise mode is done from the menu controls. */}
      {menuDockedAndOpen && state.megaMenuCustomising && <div className={styles.customiseOverlay} />}
      {!state.chromeless && !state.megaMenuDocked && <AppChromeMenu />}
      {!state.chromeless && <CommandPalette />}
      {!state.chromeless && isSplashScreenEnabled && <SplashScreenModal />}
      {!state.chromeless && <FeatureControlFloating />}
      {shouldShowReturnToPrevious && state.returnToPrevious && (
        <ReturnToPrevious href={state.returnToPrevious.href} title={state.returnToPrevious.title} />
      )}
    </div>
  );

  if (!fullscreenWorkspaceFeatureFlagEnabled) {
    return defaultChrome;
  }

  // With the fullscreen workspace feature flag enabled, we render either the fullscreen workspace
  // chrome or the default chrome depending on whether the user entered workspace mode.
  // `children` is rendered once into a stable detached node; `portalHostRef` reparents that node
  // into whichever host is active (the default <main> or the workspace host / Platform tab), so
  // toggling workspace mode moves the page's DOM without remounting it.
  return (
    <>
      {fullscreenWorkspaceActive ? fullscreenWorkspaceChrome : defaultChrome}
      {portalTargetRef.current && createPortal(children, portalTargetRef.current)}
    </>
  );
}

/**
 * When having docked mega menu we automatically undock it on smaller screens
 */
function useResponsiveDockedMegaMenu(chrome: AppChromeService) {
  const dockedMenuLocalStorageState = store.getBool(DOCKED_LOCAL_STORAGE_KEY, true);
  const isLargeScreen = useMediaQueryMinWidth('xl');

  useEffect(() => {
    // if undocked we do not need to do anything
    if (!dockedMenuLocalStorageState) {
      return;
    }

    const state = chrome.state.getValue();
    if (isLargeScreen && !state.megaMenuDocked) {
      chrome.setMegaMenuDocked(true, false);
      chrome.setMegaMenuOpen(true);
    } else if (!isLargeScreen && state.megaMenuDocked) {
      chrome.setMegaMenuDocked(false, false);
      chrome.setMegaMenuOpen(false);
    }
  }, [isLargeScreen, chrome, dockedMenuLocalStorageState]);
}

const getStyles = (theme: GrafanaTheme2, headerLevels: number, headerHeight: number, visualRefreshEnabled: boolean) => {
  return {
    content: css({
      label: 'page-content',
      display: 'flex',
      flexDirection: 'column',
      paddingTop: headerLevels * headerHeight,
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
      background: visualRefreshEnabled ? theme.colors.background.canvas : theme.colors.background.primary,
      borderRight: visualRefreshEnabled ? undefined : `1px solid ${theme.colors.border.weak}`,
      display: 'none',
      height: '100%',
      position: 'fixed',
      top: 0,
      width: MENU_WIDTH,
      zIndex: 2,

      [theme.breakpoints.up('xl')]: {
        display: 'flex',
        flexDirection: 'column',
      },
    }),
    // Covers the whole page — above the top bar (navbarFixed) but below the elevated docked menu — and
    // captures clicks so the page is locked while customising. The menu itself stays bright and usable.
    customiseOverlay: css({
      backgroundColor: theme.components.overlay.background,
      inset: 0,
      position: 'fixed',
      zIndex: theme.zIndex.modalBackdrop,
    }),
    // While customising, lift the docked menu above the overlay so it stays bright and interactive.
    dockedMegaMenuElevated: css({
      zIndex: theme.zIndex.modal,
    }),
    scopesDashboardsContainer: css({
      position: 'fixed',
      height: `calc(100% - ${headerHeight}px)`,
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
      background: visualRefreshEnabled ? theme.colors.background.canvas : theme.colors.background.primary,
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
      // the `Resizeable` component overrides the needed `position` and `height`
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      position: 'fixed !important' as 'fixed',
      top: headerHeight,
      bottom: 0,
      zIndex: theme.zIndex.navbarFixed + 1,
      right: 0,
    }),
    sidebarContainerFloating: css({
      position: 'fixed',
      top: headerLevels * headerHeight,
      bottom: 0,
      left: 0,
      right: 0,
      zIndex: theme.zIndex.navbarFixed + 1,
    }),
    portalHost: css({
      display: 'contents',
    }),
  };
};

const getContentSizeStyles = (_: GrafanaTheme2, extensionSidebarWidth = 0) => {
  return {
    contentWidth: css({
      maxWidth: `calc(100% - ${extensionSidebarWidth}px) !important`,
    }),
  };
};
