import { css, cx } from '@emotion/css';
import React, { useEffect, useLayoutEffect, useRef } from 'react';
import { useMedia } from 'react-use';

import { type GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { useSceneObjectState } from '@grafana/scenes';
import {
  ElementSelectionContext,
  useSidebar,
  useStyles2,
  useTheme2,
  Sidebar,
  type SidebarContextValue,
} from '@grafana/ui';
import NativeScrollbar, { DivScrollElement } from 'app/core/components/NativeScrollbar';
import { useGrafana } from 'app/core/context/GrafanaContext';
import { getDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';
import { playlistSrv } from 'app/features/playlist/PlaylistSrv';
import { KioskMode } from 'app/types/dashboard';

import { DashboardControlsChrome } from '../scene/DashboardControlsChrome';
import { type DashboardScene } from '../scene/DashboardScene';
import { NavToolbarActions } from '../scene/NavToolbarActions';
import { EditActionsLayoutProvider } from '../scene/edit-actions-popover/EditActionsLayoutContext';
import { PublicDashboardBadge } from '../scene/new-toolbar/actions/PublicDashboardBadge';
import { StarButton } from '../scene/new-toolbar/actions/StarButton';
import { getPlanningGround } from '../scene/planningGround';
import { dynamicDashNavActions } from '../utils/registerDynamicDashNavAction';

import { DashboardSidebarRenderer } from './DashboardSidebarRenderer';
import { type DashboardSidebarPane } from './types';

interface Props {
  dashboard: DashboardScene;
  isEditing?: boolean;
  isPlanning?: boolean;
  body?: React.ReactNode;
  controls?: React.ReactNode;
}

export function DashboardSidebarSplitter(props: Props) {
  if (config.featureToggles.dashboardNewLayouts) {
    return <DashboardSidebarSplitterNewLayouts {...props} />;
  } else {
    return <DashboardSidebarSplitterLegacy {...props} />;
  }
}

function DashboardSidebarSplitterLegacy({ dashboard, isPlanning, body, controls }: Props) {
  const styles = useStyles2(getStyles);

  return (
    <NativeScrollbar onSetScrollRef={dashboard.onSetScrollRef}>
      <div className={styles.canvasWrappperOld}>
        <NavToolbarActions dashboard={dashboard} />
        <DashboardControlsChrome>{controls}</DashboardControlsChrome>
        <div className={cx(styles.body, isPlanning && styles.planningCanvas)}>{body}</div>
      </div>
    </NativeScrollbar>
  );
}

function DashboardSidebarSplitterNewLayouts({ dashboard, isEditing, isPlanning, body, controls }: Props) {
  const { sidebar } = dashboard.state;
  const styles = useStyles2(getStyles);
  const { chrome } = useGrafana();
  const { kioskMode } = chrome.useState();
  const { isPlaying } = playlistSrv.useState();
  const containerRef = useRef<HTMLDivElement>(null);

  /**
   * Adds star button and left side actions to app chrome breadcrumb area
   */
  useUpdateAppChromeActions(dashboard);

  const { selectionContext, openPane, previousState } = useSceneObjectState(sidebar, {
    shouldActivateOrKeepAlive: true,
  });

  // Selection is only needed in edit mode.
  useEffect(() => {
    if (isEditing) {
      sidebar.enableSelection();
    } else {
      sidebar.disableSelection();
    }
  }, [isEditing, sidebar]);

  const theme = useTheme2();
  const isMobile = useMedia(`(max-width: ${theme.breakpoints.values.sm}px)`);
  const sidebarContext = useSidebar({
    hasOpenPane: Boolean(openPane),
    contentMargin: 1,
    position: 'right',
    persistenceKey: isEditing ? 'dashboard' : 'dashboard-view',
    hiddenPersistenceKey: 'dashboard',
    defaultToDocked: isEditing ? true : false,
    onClosePane: () => sidebar.closePane(),
    onGoBack: () => sidebar.goBackToPrevious(),
    canGoBack: previousState !== undefined,
    defaultIsHidden: isEditing ? false : isMobile,
  });

  useSidebarPaneMinWidth(openPane, sidebarContext);

  /**
   * Sync docked state to sidebar state
   */
  useEffect(() => {
    sidebar.setState({ isDocked: sidebarContext.isDocked });
  }, [sidebarContext.isDocked, sidebar]);

  const onClearSelection: React.PointerEventHandler<HTMLDivElement> = (evt) => {
    if (evt.shiftKey) {
      return;
    }

    sidebar.clearSelection();
  };

  const onBodyRef = (ref: HTMLDivElement | null) => {
    if (ref) {
      dashboard.onSetScrollRef(new DivScrollElement(ref));
    }
  };

  function renderBody() {
    const renderWithoutSidebar = isPlaying || kioskMode === KioskMode.Full;

    // In kiosk mode the full document body scrolls so we don't need to wrap in our own scrollbar
    if (renderWithoutSidebar) {
      return (
        <div
          className={cx(styles.bodyWrapper, styles.bodyWrapperKiosk, isPlanning && styles.planningCanvas)}
          data-testid={selectors.components.DashboardSidebarSplitter.primaryBody}
        >
          <NativeScrollbar onSetScrollRef={dashboard.onSetScrollRef}>{body}</NativeScrollbar>
        </div>
      );
    }

    return (
      <div
        className={styles.bodyWrapper}
        data-testid={selectors.components.DashboardSidebarSplitter.primaryBody}
        {...sidebarContext.outerWrapperProps}
      >
        <div
          className={cx(
            styles.scrollContainer,
            sidebarContext.isHiddenPreference && styles.scrollContainerNoSidebar,
            isPlanning && styles.planningCanvas
          )}
          ref={onBodyRef}
          onPointerDown={onClearSelection}
          data-testid={selectors.components.DashboardSidebarSplitter.bodyContainer}
          // The dashboard scrolls inside this element rather than the document body, so make it
          // focusable; without this, arrow/page keys can't scroll the dashboard once it's focused.
          // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
          tabIndex={0}
          aria-label={t('dashboard.layout.scroll-content', 'Dashboard content')}
        >
          {body}
        </div>

        <Sidebar contextValue={sidebarContext}>
          <DashboardSidebarRenderer dashboard={dashboard} />
        </Sidebar>
      </div>
    );
  }

  return (
    <div ref={containerRef} className={styles.container}>
      <EditActionsLayoutProvider
        containerRef={containerRef}
        isDocked={sidebarContext.isDocked}
        isHidden={sidebarContext.isHidden}
      >
        <ElementSelectionContext.Provider value={selectionContext}>
          <DashboardControlsChrome onPointerDown={onClearSelection}>{controls}</DashboardControlsChrome>
          {renderBody()}
        </ElementSelectionContext.Provider>
      </EditActionsLayoutProvider>
    </div>
  );
}

function useSidebarPaneMinWidth(openPane: DashboardSidebarPane | undefined, sidebarContext: SidebarContextValue) {
  const originalPaneWidthRef = useRef<number | null>(null);
  const previousPaneRef = useRef<DashboardSidebarPane | undefined>(undefined);

  useEffect(() => {
    previousPaneRef.current = openPane;

    if (openPane?.minWidth && sidebarContext.paneWidth < openPane.minWidth) {
      originalPaneWidthRef.current = sidebarContext.paneWidth;
      const diff = openPane.minWidth - sidebarContext.paneWidth;
      sidebarContext.onResize(diff);
    }

    // If we are switching to a different openPane without minWidth
    if (openPane && !openPane.minWidth && originalPaneWidthRef.current !== null) {
      const diff = originalPaneWidthRef.current - sidebarContext.paneWidth;
      sidebarContext.onResize(diff);
      originalPaneWidthRef.current = null;
    }
  }, [openPane, sidebarContext]);
}

function useUpdateAppChromeActions(dashboard: DashboardScene) {
  const { chrome } = useGrafana();

  useLayoutEffect(() => {
    const hasUid = Boolean(dashboard.state.uid);
    const canStar = Boolean(dashboard.state.meta.canStar);
    const isSnapshot = Boolean(dashboard.state.meta.isSnapshot);

    const breadcrumbActions = (
      <>
        {hasUid && canStar && <StarButton dashboard={dashboard} />}
        {hasUid && canStar && !isSnapshot && <PublicDashboardBadge dashboard={dashboard} />}
        {renderDynamicNavActions()}
      </>
    );

    chrome.update({ breadcrumbActions });

    return () => {
      chrome.update({ breadcrumbActions: undefined });
    };
  }, [chrome, dashboard]);
}

function renderDynamicNavActions() {
  const dashboard = getDashboardSrv().getCurrent()!;
  const showProps = { dashboard };

  return dynamicDashNavActions.left.map((action, index) => {
    if (action.show(showProps)) {
      const ActionComponent = action.component;
      return <ActionComponent key={index} dashboard={dashboard} />;
    }
    return null;
  });
}

function getStyles(theme: GrafanaTheme2) {
  return {
    canvasWrappperOld: css({
      label: 'canvas-wrapper-old',
      display: 'flex',
      flexDirection: 'column',
      flexGrow: 1,
    }),
    container: css({
      label: 'container',
      display: 'flex',
      flexDirection: 'column',
      flexGrow: 1,
      position: 'relative',
      // creates a stacking context above the mega menu (z-index=2, so the date pickers appear on top) and
      // below the app top bar (z-index=1000, so the popovers appears below)
      zIndex: 3,
    }),
    bodyWrapper: css({
      label: 'body-wrapper',
      display: 'flex',
      flexDirection: 'column',
      flexGrow: 1,
      position: 'relative',
      flex: '1 1 0',
      // minHeight (not overflow: hidden) constrains this flex item without clipping the
      // scrollContainer bleed strip below.
      minHeight: 0,

      [theme.breakpoints.down('sm')]: {
        flex: 1,

        '> div:nth-child(2)': {
          zIndex: theme.zIndex.activePanel,
        },
      },
    }),
    bodyWrapperKiosk: css({
      padding: theme.spacing(0, 2, 2, 2),
    }),
    /**
     * A plan preview is not a dashboard, and it must not be mistaken for one by a reader whose
     * attention is on the canvas rather than the banner above it. Dashed panel borders read as
     * "draft" at a glance without obscuring the layout, which is the one thing the preview exists
     * to let the user judge.
     *
     * Selector note: the bordered element is PanelChrome's <section>, whose emotion class is not a
     * stable hook (labels are stripped in production builds). `data-viz-panel-key` is set by the
     * scenes VizPanel renderer on the wrapper around it and is stable.
     */
    planningCanvas: css({
      // The canvas is the largest surface on the page and said nothing. A tint one step off the
      // dashboard ground plus a faint dot grid reads in peripheral vision, and — unlike the panel
      // treatments below — it still says "plan" in the three cases they miss: a panel the user adds
      // by hand (no seeded data, so no badge), a plan whose panels are all below the fold, and a
      // plan with nothing in it at all.
      ...getPlanningGround(theme),
      boxShadow: `inset 0 0 0 1px ${theme.colors.primary.borderTransparent}`,
      '[data-viz-panel-key] section': {
        // Both halves matter. Grafana's panel border is border.weak — 12% opacity — and simply
        // switching that to dashed is imperceptible, so the planning border also steps up to
        // border.strong to carry the signal.
        borderStyle: 'dashed',
        borderColor: theme.colors.border.strong,
      },
    }),
    scrollContainer: css({
      display: 'flex',
      flexDirection: 'column',
      flexGrow: 1,
      minHeight: 0,
      overflow: 'auto',
      scrollbarWidth: 'thin',
      scrollbarGutter: 'stable',
      // the tabIndex is only here to allow keyboard scrolling, so suppress the focus outline.
      outline: 'none',
      // Clip-bleed: top padding + matching negative margin cancel out visually but extend the
      // clip box under the controls bar, so top-row selection outlines aren't sheared off. The
      // bar paints over the overlap — see DashboardControlsChrome.
      padding: theme.spacing(1.125, 1, 2, 2),
      marginTop: theme.spacing(-1),
    }),
    scrollContainerNoSidebar: css({
      paddingRight: theme.spacing(2),
    }),
    body: css({
      label: 'body',
      display: 'flex',
      flexGrow: 1,
      gap: theme.spacing(1),
      boxSizing: 'border-box',
      flexDirection: 'column',
      padding: theme.spacing(0, 2, 2, 2),
    }),
    bodyEditing: css({
      position: 'absolute',
      left: 0,
      top: 0,
      right: 0,
      bottom: 0,
      overflow: 'auto',
      scrollbarWidth: 'thin',
      scrollbarGutter: 'stable',
      // Because the sidebar splitter handle area adds padding we can reduce it here
      paddingRight: theme.spacing(1),
    }),
  };
}
