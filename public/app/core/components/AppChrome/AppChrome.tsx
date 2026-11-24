import { css, cx } from '@emotion/css';
import { useBooleanFlagValue } from '@openfeature/react-sdk';
import classNames from 'clsx';
import { Resizable } from 're-resizable';
import { lazy, type PropsWithChildren, Suspense, useEffect } from 'react';
import { useWindowSize } from 'react-use';

import { type GrafanaTheme2, store } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { locationSearchToObject, locationService, useScopes } from '@grafana/runtime';
import {
  useFlagGrafanaMegaMenuPeekAndDock,
  useFlagGrafanaScopesDashboardsMegaMenu,
  useFlagGrafanaVisualDesignRefresh,
} from '@grafana/runtime/internal';
import { ErrorBoundaryAlert, floatingUtils, getDragStyles, LinkButton, useStyles2 } from '@grafana/ui';
import { DRAWER_INSIDE_ATTRIBUTE } from '@grafana/ui/internal';
import { SplashScreenModal } from 'app/core/components/SplashScreenModal/SplashScreenModal';
import { useGrafana } from 'app/core/context/GrafanaContext';
import { useMediaQueryMinWidth } from 'app/core/hooks/useMediaQueryMinWidth';
import { ScopesDashboards } from 'app/features/scopes/dashboards/ScopesDashboards';

import { AppChromeMenu } from './AppChromeMenu';
import { type AppChromeService, DOCKED_LOCAL_STORAGE_KEY } from './AppChromeService';
import { ExtensionSidebar } from './ExtensionSidebar/ExtensionSidebar';
import { useExtensionSidebarContext } from './ExtensionSidebar/ExtensionSidebarProvider';
import {
  getMaxExtensionSidebarHeight,
  MAX_EXTENSION_SIDEBAR_WIDTH,
  MIN_EXTENSION_SIDEBAR_HEIGHT,
  MIN_EXTENSION_SIDEBAR_WIDTH,
} from './ExtensionSidebar/constants';
import { LazyFeatureControlFloating } from './FeatureControl/LazyFeatureControl';
import { MegaMenu, MENU_WIDTH } from './MegaMenu/MegaMenu';
import { useMegaMenuFocusHelper } from './MegaMenu/utils';
import { PageAreaEndsAboveDockContext } from './PageAreaEnd';
import { ReturnToPrevious } from './ReturnToPrevious/ReturnToPrevious';
import { SingleTopBar } from './TopBar/SingleTopBar';
import { getChromeHeaderLevelHeight, useChromeHeaderLevels } from './TopBar/useChromeHeaderHeight';
import { AutoOpenMegaMenuForScopedContent } from './useAutoOpenMegaMenuForScopedContent';

export const EXTENSION_SIDEBAR_FLOATING_TESTID = 'extension-sidebar-floating';
const SIDE_PANEL_WIDTH = '240px';

const CommandPalette = lazy(() =>
  import('app/features/commandPalette/CommandPalette').then((module) => ({ default: module.CommandPalette }))
);

export interface Props extends PropsWithChildren<{}> {}

export function AppChrome({ children }: Props) {
  const { chrome } = useGrafana();
  const visualRefreshEnabled = useFlagGrafanaVisualDesignRefresh();
  const scopesMegaMenuEnabled = useFlagGrafanaScopesDashboardsMegaMenu();
  const megaMenuPeekAndDock = useFlagGrafanaMegaMenuPeekAndDock();
  const {
    isOpen: isExtensionSidebarOpen,
    extensionSidebarWidth,
    setExtensionSidebarWidth,
    extensionSidebarHeight,
    setExtensionSidebarHeight,
    floatingExtensionSidebarWidth,
    presentation: extensionSidebarPresentation,
    dockSide: extensionSidebarDockSide,
    floatingHidden: isExtensionSidebarFloatingHidden,
  } = useExtensionSidebarContext();
  const isExtensionSidebarFloating = isExtensionSidebarOpen && extensionSidebarPresentation === 'floating';
  const isExtensionSidebarDockedLeft =
    isExtensionSidebarOpen && !isExtensionSidebarFloating && extensionSidebarDockSide === 'left';
  const isExtensionSidebarDockedBottom =
    isExtensionSidebarOpen && !isExtensionSidebarFloating && extensionSidebarDockSide === 'bottom';
  // Floating, the sidebar sits above drawers, so an open drawer must not hide it from keyboard and screen reader users.
  const floatingSidebarAttributes = isExtensionSidebarFloating ? { [DRAWER_INSIDE_ATTRIBUTE]: '' } : {};
  const state = chrome.useState();
  const scopes = useScopes();
  const isSplashScreenEnabled = useBooleanFlagValue('splashScreen', false);

  const menuDockedAndOpen = !state.chromeless && state.megaMenuDocked && state.megaMenuOpen;
  const isScopesDashboardsOpen = Boolean(
    !state.chromeless && !scopesMegaMenuEnabled && scopes?.state.enabled && scopes?.state.drawerOpened
  );

  // How far the page content starts from the window's left edge: past the docked nav and the scopes dashboards,
  // matching `pageContainerMenuDocked*`. A left-docked sidebar sits there.
  const navOffset = ['0px', MENU_WIDTH, `calc(${MENU_WIDTH} * 2)`][
    Number(menuDockedAndOpen) + Number(isScopesDashboardsOpen)
  ];

  const headerLevels = useChromeHeaderLevels();
  const fitsSidePanel = useMediaQueryMinWidth('md');
  const showSidePanel = Boolean(state.sidePanel && fitsSidePanel && !state.chromeless && !isScopesDashboardsOpen);
  const showCompactSidePanel = Boolean(state.sidePanel && !fitsSidePanel && !state.chromeless);
  const styles = useStyles2(getStyles, headerLevels, getChromeHeaderLevelHeight(), visualRefreshEnabled);
  const contentSizeStyles = useStyles2(
    getContentSizeStyles,
    extensionSidebarWidth,
    floatingExtensionSidebarWidth,
    navOffset,
    extensionSidebarHeight,
    showSidePanel ? SIDE_PANEL_WIDTH : undefined,
    visualRefreshEnabled
  );
  const dragStyles = useStyles2(getDragStyles, 'middle');
  const isSmallScreen = !useMediaQueryMinWidth('sm');
  const { height: windowHeight } = useWindowSize();

  useResponsiveDockedMegaMenu(chrome);
  useMegaMenuFocusHelper(state.megaMenuOpen, state.megaMenuDocked, state.megaMenuPeek);

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

  // The page learns whether the sidebar is docked below it, where the page keeps its card's bottom edge in view.
  const pageEndsAboveDock = !state.chromeless && !isSmallScreen && isExtensionSidebarDockedBottom;

  // Chromeless routes are without topNav, mega menu, search & command palette
  // We check chromeless twice here instead of having a separate path so {children}
  // doesn't get re-mounted when chromeless goes from true to false.
  return (
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
            <MegaMenu className={styles.dockedMegaMenu} onClose={() => chrome.setMegaMenuOpen(false)} />
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
          {!state.chromeless && !scopesMegaMenuEnabled && (
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
          {showSidePanel && (
            <div
              className={cx(styles.sidePanelContainer, {
                [styles.sidePanelContainerDocked]: menuDockedAndOpen,
              })}
            >
              {state.sidePanel?.full}
            </div>
          )}
          <main
            className={cx(styles.pageContainer, {
              [styles.pageContainerMenuDocked]: menuDockedAndOpen || isScopesDashboardsOpen,
              [styles.pageContainerMenuDockedScopes]: menuDockedAndOpen && isScopesDashboardsOpen,
              [styles.pageContainerSidePanel]: showSidePanel && !menuDockedAndOpen,
              [styles.pageContainerSidePanelDocked]: showSidePanel && menuDockedAndOpen,
              [styles.pageContainerCompactSidePanel]: showCompactSidePanel,
              [styles.pageContainerWithSidebar]: !state.chromeless && isExtensionSidebarOpen,
              // Floating takes no width from the page, so the docked width is 0.
              [contentSizeStyles.contentWidth]:
                !state.chromeless &&
                isExtensionSidebarOpen &&
                !isSmallScreen &&
                !isExtensionSidebarFloating &&
                !isExtensionSidebarDockedLeft &&
                !isExtensionSidebarDockedBottom,
              // Docked on the left, the sidebar takes its width from the start of the page, after the nav.
              [contentSizeStyles.contentDockedLeft]:
                !state.chromeless && !isSmallScreen && isExtensionSidebarDockedLeft,
              // Docked at the bottom, it takes its height from the page's bottom instead, so the page ends above it.
              [contentSizeStyles.contentDockedBottom]:
                !state.chromeless && !isSmallScreen && isExtensionSidebarDockedBottom,
            })}
            id="pageContent"
            tabIndex={-1}
          >
            {showCompactSidePanel && <div className={styles.sidePanelCompact}>{state.sidePanel?.compact}</div>}
            <PageAreaEndsAboveDockContext.Provider value={pageEndsAboveDock}>
              {children}
            </PageAreaEndsAboveDockContext.Provider>
          </main>
          {!state.chromeless &&
            isExtensionSidebarOpen &&
            (isSmallScreen ? (
              <div
                className={cx(
                  styles.sidebarContainerFloating,
                  isExtensionSidebarFloating && [styles.sidebarContainerFloatingBar, contentSizeStyles.floatingWidth],
                  isExtensionSidebarFloatingHidden && styles.sidebarContainerHidden
                )}
                data-testid={EXTENSION_SIDEBAR_FLOATING_TESTID}
                {...floatingSidebarAttributes}
              >
                <ExtensionSidebar />
              </div>
            ) : (
              // Docked on any edge and floating share this container so the extension never remounts: it stays
              // after the page in the DOM, so the tab order does not change either. Floating only restyles it and
              // turns off resizing; docking on the left moves it next to the nav, resized from its right edge, and
              // docking at the bottom moves it below the page, past the nav, resized from its top edge.
              <Resizable
                className={cx(styles.sidebarContainer, {
                  [styles.sidebarContainerDockedLeft]: isExtensionSidebarDockedLeft,
                  [styles.sidebarContainerDockedBottom]: isExtensionSidebarDockedBottom,
                  // One class for both: as keys here, two identical ones would overwrite each other.
                  [contentSizeStyles.sidebarAfterNav]: isExtensionSidebarDockedLeft || isExtensionSidebarDockedBottom,
                  [styles.sidebarContainerFloatingBar]: isExtensionSidebarFloating,
                  [contentSizeStyles.floatingWidth]: isExtensionSidebarFloating,
                  [styles.sidebarContainerHidden]: isExtensionSidebarFloatingHidden,
                })}
                // Docked at the bottom it spans the page; on a side, the page's full height.
                size={
                  isExtensionSidebarDockedBottom
                    ? { width: 'auto', height: extensionSidebarHeight }
                    : { width: extensionSidebarWidth, height: 'auto' }
                }
                enable={
                  isExtensionSidebarFloating
                    ? false
                    : isExtensionSidebarDockedLeft
                      ? { right: true }
                      : isExtensionSidebarDockedBottom
                        ? { top: true }
                        : { left: true }
                }
                onResize={(_evt, _direction, ref) => {
                  const { width, height } = ref.getBoundingClientRect();
                  if (isExtensionSidebarDockedBottom) {
                    setExtensionSidebarHeight(height);
                  } else {
                    setExtensionSidebarWidth(width);
                  }
                }}
                handleClasses={{
                  left: dragStyles.dragHandleVertical,
                  right: dragStyles.dragHandleVertical,
                  top: dragStyles.dragHandleHorizontal,
                }}
                handleStyles={{ left: { left: -7 }, right: { right: -7 }, top: { top: -7 } }}
                // Floating has its own, lower minimum; an inline min-width would override `floatingWidth`. Docked at
                // the bottom, the width follows the page and only the height is bounded.
                minWidth={
                  isExtensionSidebarFloating || isExtensionSidebarDockedBottom ? undefined : MIN_EXTENSION_SIDEBAR_WIDTH
                }
                maxWidth={isExtensionSidebarDockedBottom ? undefined : MAX_EXTENSION_SIDEBAR_WIDTH}
                minHeight={isExtensionSidebarDockedBottom ? MIN_EXTENSION_SIDEBAR_HEIGHT : undefined}
                maxHeight={isExtensionSidebarDockedBottom ? getMaxExtensionSidebarHeight(windowHeight) : undefined}
                {...floatingSidebarAttributes}
              >
                <ExtensionSidebar />
              </Resizable>
            ))}
        </div>
      </div>
      {/* A peek opens a closed docked menu over the page. The overlay stays mounted while docked, so the menu opens in it
          as it does from undocked, and its dialog does not take focus on mount. */}
      {!state.chromeless && (megaMenuPeekAndDock || !state.megaMenuDocked) && <AppChromeMenu />}
      {!state.chromeless && (
        <Suspense fallback={null}>
          <CommandPalette />
        </Suspense>
      )}
      {!state.chromeless && isSplashScreenEnabled && <SplashScreenModal />}
      {!state.chromeless && <LazyFeatureControlFloating />}
      {scopesMegaMenuEnabled && <AutoOpenMegaMenuForScopedContent chrome={chrome} />}
      {shouldShowReturnToPrevious && state.returnToPrevious && (
        <ReturnToPrevious
          href={state.returnToPrevious.href}
          title={state.returnToPrevious.title}
          // Docked at the bottom, the Assistant takes the window's bottom edge; the button stays above it.
          bottomInset={pageEndsAboveDock ? extensionSidebarHeight : 0}
        />
      )}
    </div>
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
  // The chrome draws the right half of the card, so it is there while a lazy page is still loading.
  // The page's own card is flattened to sit inside it.
  const pageCardJoinedToNav = {
    background: 'transparent',
    border: 'none',
    borderRadius: 'unset',
    margin: `0 calc(${theme.spacing(0.5)} + 1px) calc(${theme.spacing(0.5)} + 1px) 0`,
  } as const;

  const pageCardFrame = (left: string) => ({
    isolation: 'isolate' as const,
    position: 'relative' as const,
    '&::before': {
      content: '""',
      position: 'absolute' as const,
      zIndex: -1,
      top: 0,
      bottom: theme.spacing(0.5),
      left,
      right: theme.spacing(0.5),
      background: theme.colors.background.page,
      border: `1px solid ${theme.colors.border.weak}`,
      borderLeft: 'none',
      borderRadius: theme.shape.radius.lg,
      borderBottomLeftRadius: 'unset',
      borderTopLeftRadius: 'unset',
    },
  });

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
    scopesDashboardsContainer: css({
      position: 'fixed',
      height: `calc(100% - ${headerHeight}px)`,
      zIndex: 1,
    }),
    scopesDashboardsContainerDocked: css(
      {
        left: MENU_WIDTH,
      },
      visualRefreshEnabled && {
        left: `calc(${MENU_WIDTH} + ${theme.spacing(0.5)})`,
      }
    ),
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
    sidePanelContainer: css(
      {
        position: 'fixed',
        top: headerLevels * headerHeight,
        bottom: 0,
        left: 0,
        width: SIDE_PANEL_WIDTH,
        overflowY: 'auto',
        zIndex: 1,
        borderRight: `1px solid ${theme.colors.border.weak}`,
      },
      // Forms the left edge of the page card, so the card's own left border and corners are dropped (see pageContainerSidePanel)
      visualRefreshEnabled && {
        bottom: theme.spacing(0.5),
        left: theme.spacing(0.5),
        background: theme.colors.background.page,
        border: `1px solid ${theme.colors.border.weak}`,
        borderRadius: theme.shape.radius.lg,
        borderBottomRightRadius: 'unset',
        borderTopRightRadius: 'unset',
      }
    ),
    sidePanelCompact: css({
      padding: visualRefreshEnabled ? theme.spacing(1.5, 1.5, 1) : theme.spacing(1, 2, 1),
    }),
    pageContainerCompactSidePanel: css(
      visualRefreshEnabled && {
        isolation: 'isolate',
        position: 'relative',
        '&::before': {
          content: '""',
          position: 'absolute',
          zIndex: -1,
          top: 0,
          bottom: theme.spacing(0.5),
          left: theme.spacing(0.5),
          right: theme.spacing(0.5),
          background: theme.colors.background.page,
          border: `1px solid ${theme.colors.border.weak}`,
          borderRadius: theme.shape.radius.lg,
        },
        '& [data-page-card]': {
          ...pageCardJoinedToNav,
          margin: `0 calc(${theme.spacing(0.5)} + 1px) calc(${theme.spacing(0.5)} + 1px)`,
        },
      }
    ),
    sidePanelContainerDocked: css(
      {
        left: MENU_WIDTH,
      },
      visualRefreshEnabled && {
        left: `calc(${MENU_WIDTH} + ${theme.spacing(0.5)})`,
      }
    ),
    pageContainerSidePanel: css(
      {
        paddingLeft: SIDE_PANEL_WIDTH,
      },
      visualRefreshEnabled && {
        paddingLeft: `calc(${SIDE_PANEL_WIDTH} + ${theme.spacing(0.5)})`,
        ...pageCardFrame(`calc(${SIDE_PANEL_WIDTH} + ${theme.spacing(0.5)})`),
        '& [data-page-card]': pageCardJoinedToNav,
      }
    ),
    pageContainerSidePanelDocked: css(
      {
        paddingLeft: `calc(${MENU_WIDTH} + ${SIDE_PANEL_WIDTH})`,
      },
      visualRefreshEnabled && {
        paddingLeft: `calc(${MENU_WIDTH} + ${SIDE_PANEL_WIDTH} + ${theme.spacing(0.5)})`,
        ...pageCardFrame(`calc(${MENU_WIDTH} + ${SIDE_PANEL_WIDTH} + ${theme.spacing(0.5)})`),
        '& [data-page-card]': pageCardJoinedToNav,
      }
    ),
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
    // Below the whole header, so the toolbar row keeps its full width; its `left` comes from `getContentSizeStyles`.
    sidebarContainerDockedLeft: css({
      top: headerLevels * headerHeight,
      right: 'auto',
    }),
    // Below the page, up to the window's right edge; its `left` comes from `getContentSizeStyles`, its height inline.
    sidebarContainerDockedBottom: css({
      top: 'auto',
      right: 0,
    }),
    // A panel anchored to the bottom right: content-driven height, no chrome of its own.
    // Its width comes from `getContentSizeStyles`.
    sidebarContainerFloatingBar: css({
      // `Resizable` sets width and height inline.
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      height: 'auto !important' as 'auto',
      top: 'auto',
      left: 'auto',
      // Matches the page's own padding, so the snap points (which reuse this inset) line up with its panes.
      right: theme.spacing(2),
      bottom: theme.spacing(2),
      background: 'transparent',
      // The sidebar inside can be moved off this box; the box itself must not block the page.
      pointerEvents: 'none',
      // Above drawers and their mask (modalBackdrop), so the Assistant stays usable beside, for example, panel
      // inspect; below modal dialogs, and below the portal that tooltips and menus (its own included) render in.
      zIndex: theme.zIndex.modalBackdrop + 1,
    }),
    // A page holds the floating sidebar hidden: it stays mounted, so it takes over the page's prompt at once.
    sidebarContainerHidden: css({
      display: 'none',
    }),
    sidebarContainerFloating: css({
      position: 'fixed',
      top: headerLevels * headerHeight,
      bottom: 0,
      left: 0,
      right: 0,
      zIndex: theme.zIndex.navbarFixed + 1,
    }),
  };
};

const getContentSizeStyles = (
  theme: GrafanaTheme2,
  extensionSidebarWidth = 0,
  floatingExtensionSidebarWidth = 0,
  navOffset = '0px',
  extensionSidebarHeight = 0,
  sidePanelWidth?: string,
  visualRefreshEnabled = false
) => {
  // The side panel sits against the nav, so a sidebar docked on the left starts after it too, where the page does.
  const sidebarOffset = sidePanelWidth
    ? `calc(${navOffset} + ${sidePanelWidth}${visualRefreshEnabled ? ` + ${theme.spacing(0.5)}` : ''})`
    : navOffset;
  return {
    contentWidth: css({
      maxWidth: `calc(100% - ${extensionSidebarWidth}px) !important`,
    }),
    // Replaces `pageContainerMenuDocked*`'s padding, which only reserves the nav.
    contentDockedLeft: css({
      paddingLeft: `calc(${sidebarOffset} + ${extensionSidebarWidth}px) !important`,
    }),
    // Docked on the left or at the bottom, the sidebar starts where the page content does, past the nav.
    sidebarAfterNav: css({
      left: sidebarOffset,
    }),
    // The page keeps its width and ends where the sidebar starts, rather than scrolling under it.
    contentDockedBottom: css({
      maxHeight: `calc(100% - ${extensionSidebarHeight}px) !important`,
    }),
    floatingWidth: css({
      // `Resizable` sets width inline.
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      width: `min(${floatingExtensionSidebarWidth}px, calc(100% - ${theme.spacing(4)})) !important` as 'auto',
    }),
  };
};
