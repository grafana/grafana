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
import { PublicDashboardBadge } from '../scene/new-toolbar/actions/PublicDashboardBadge';
import { StarButton } from '../scene/new-toolbar/actions/StarButton';
import { dynamicDashNavActions } from '../utils/registerDynamicDashNavAction';

import { DashboardSidebarRenderer } from './DashboardSidebarRenderer';
import { type DashboardSidebarPane } from './types';

interface Props {
  dashboard: DashboardScene;
  isEditing?: boolean;
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

function DashboardSidebarSplitterLegacy({ dashboard, body, controls }: Props) {
  const styles = useStyles2(getStyles);

  return (
    <NativeScrollbar onSetScrollRef={dashboard.onSetScrollRef}>
      <div className={styles.canvasWrappperOld}>
        <NavToolbarActions dashboard={dashboard} />
        <DashboardControlsChrome>{controls}</DashboardControlsChrome>
        <div className={styles.body}>{body}</div>
      </div>
    </NativeScrollbar>
  );
}

function DashboardSidebarSplitterNewLayouts({ dashboard, isEditing, body, controls }: Props) {
  const { sidebar } = dashboard.state;
  const styles = useStyles2(getStyles);
  const { chrome } = useGrafana();
  const { kioskMode } = chrome.useState();
  const { isPlaying } = playlistSrv.useState();

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
          className={cx(styles.bodyWrapper, styles.bodyWrapperKiosk)}
          data-testid={selectors.components.DashboardSidebarSplitter.primaryBody}
          data-dashboard-body
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
          className={cx(styles.scrollContainer, sidebarContext.isHiddenPreference && styles.scrollContainerNoSidebar)}
          ref={onBodyRef}
          onPointerDown={onClearSelection}
          data-testid={selectors.components.DashboardSidebarSplitter.bodyContainer}
          data-dashboard-body
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
    <div className={styles.container}>
      <ElementSelectionContext.Provider value={selectionContext}>
        <DashboardControlsChrome onPointerDown={onClearSelection}>{controls}</DashboardControlsChrome>
        {renderBody()}
      </ElementSelectionContext.Provider>
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
      padding: theme.spacing(1, 1, 2, 2),
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
