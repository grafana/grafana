import { css, cx } from '@emotion/css';
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useMedia } from 'react-use';

import { type GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { config, useChromeHeaderHeight } from '@grafana/runtime';
import { type VizPanel, useSceneObjectState } from '@grafana/scenes';
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
import { playlistSrv } from 'app/features/playlist/PlaylistSrv';
import { KioskMode } from 'app/types/dashboard';

import { type PopoverTarget, AssistantPopoverContext } from '../assistant/AssistantPopoverContext';
import {
  useDashboardAssistantViewMode,
  usePopoverDismissOnClickOutside,
} from '../assistant/DashboardAssistantViewMode';
import { ViewModePanelPromptCard } from '../assistant/ViewModePanelPromptCard';
import { type DashboardScene } from '../scene/DashboardScene';
import { NavToolbarActions } from '../scene/NavToolbarActions';
import { BreadcrumbActions } from '../scene/new-toolbar/BreadcrumbActions';

import { DashboardEditPaneRenderer } from './DashboardEditPaneRenderer';
import { type DashboardSidebarPane } from './types';

interface Props {
  dashboard: DashboardScene;
  isEditing?: boolean;
  body?: React.ReactNode;
  controls?: React.ReactNode;
}

export function DashboardEditPaneSplitter(props: Props) {
  if (config.featureToggles.dashboardNewLayouts) {
    return <DashboardEditPaneSplitterNewLayouts {...props} />;
  } else {
    return <DashboardEditPaneSplitterLegacy {...props} />;
  }
}

function DashboardEditPaneSplitterLegacy({ dashboard, body, controls }: Props) {
  const headerHeight = useChromeHeaderHeight();
  const styles = useStyles2(getStyles, headerHeight ?? 0);

  return (
    <NativeScrollbar onSetScrollRef={dashboard.onSetScrollRef}>
      <div className={styles.canvasWrappperOld}>
        <NavToolbarActions dashboard={dashboard} />
        <div className={styles.controlsWrapperSticky}>{controls}</div>
        <div className={styles.body}>{body}</div>
      </div>
    </NativeScrollbar>
  );
}

function DashboardEditPaneSplitterNewLayouts({ dashboard, isEditing, body, controls }: Props) {
  const headerHeight = useChromeHeaderHeight();
  const { editPane } = dashboard.state;
  const styles = useStyles2(getStyles, headerHeight ?? 0);
  const { chrome } = useGrafana();
  const { kioskMode } = chrome.useState();
  const { isPlaying } = playlistSrv.useState();

  useUpdateAppChromeBreadcrumbActions(dashboard);

  const { selectionContext, openPane, previousState } = useSceneObjectState(editPane, {
    shouldActivateOrKeepAlive: true,
  });

  const { isEnabled: isAssistantEnabled } = useDashboardAssistantViewMode({
    dashboard,
    isEditing,
  });

  // --- Assistant popover state (decoupled from selection system) ---
  // Stores an array of PopoverTargets to support multi-panel context.
  // Once the popover is open, clicking another sparkle adds that panel;
  // clicking the same sparkle again removes it (toggle).
  const [popoverTargets, setPopoverTargets] = useState<PopoverTarget[]>([]);

  // Close popover when entering edit mode
  useEffect(() => {
    if (isEditing) {
      setPopoverTargets([]);
    }
  }, [isEditing]);

  const clearPopover = useCallback(() => setPopoverTargets([]), []);
  usePopoverDismissOnClickOutside(popoverTargets.length > 0, clearPopover);

  const popoverContextValue = useMemo(
    () => ({
      openPopover: (panel: VizPanel, anchorEl: HTMLElement, multi: boolean) => {
        setPopoverTargets((prev) => {
          const exists = prev.findIndex((t) => t.panel === panel);

          if (multi) {
            // Shift+click: toggle panel in/out of the selection
            if (exists >= 0) {
              return prev.filter((_, i) => i !== exists);
            }
            return [...prev, { panel, anchorEl }];
          }

          // Plain click: replace selection, or toggle off if already the only one
          if (exists >= 0 && prev.length === 1) {
            return [];
          }
          return [{ panel, anchorEl }];
        });
      },
    }),
    []
  );

  // Selection is only needed in edit mode — the assistant popover is triggered
  // exclusively via the sparkle button, not through the selection system.
  useEffect(() => {
    if (isEditing) {
      editPane.enableSelection();
    } else {
      editPane.disableSelection();
    }
  }, [isEditing, editPane]);

  const theme = useTheme2();
  const isMobile = useMedia(`(max-width: ${theme.breakpoints.values.sm}px)`);
  const sidebarContext = useSidebar({
    hasOpenPane: Boolean(openPane),
    contentMargin: 1,
    position: 'right',
    persistenceKey: isEditing ? 'dashboard' : 'dashboard-view',
    hiddenPersistenceKey: 'dashboard',
    defaultToDocked: isEditing ? true : false,
    onClosePane: () => editPane.closePane(),
    onGoBack: () => editPane.goBackToPrevious(),
    canGoBack: previousState !== undefined,
    defaultIsHidden: isEditing ? false : isMobile,
  });

  useSidebarPaneMinWidth(openPane, sidebarContext);

  /**
   * Sync docked state to editPane state
   */
  useEffect(() => {
    editPane.setState({ isDocked: sidebarContext.isDocked });
  }, [sidebarContext.isDocked, editPane]);

  const onClearSelection: React.PointerEventHandler<HTMLDivElement> = (evt) => {
    if (evt.shiftKey) {
      return;
    }

    editPane.clearSelection();
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
          data-testid={selectors.components.DashboardEditPaneSplitter.primaryBody}
        >
          <NativeScrollbar onSetScrollRef={dashboard.onSetScrollRef}>{body}</NativeScrollbar>
        </div>
      );
    }

    return (
      <div
        className={styles.bodyWrapper}
        data-testid={selectors.components.DashboardEditPaneSplitter.primaryBody}
        {...sidebarContext.outerWrapperProps}
      >
        <div
          className={cx(styles.scrollContainer, sidebarContext.isHiddenPreference && styles.scrollContainerNoSidebar)}
          ref={onBodyRef}
          onPointerDown={onClearSelection}
          data-testid={selectors.components.DashboardEditPaneSplitter.bodyContainer}
        >
          {body}
        </div>

        <Sidebar contextValue={sidebarContext}>
          <DashboardEditPaneRenderer editPane={editPane} dashboard={dashboard} />
        </Sidebar>
      </div>
    );
  }

  const showPopover = !isEditing && isAssistantEnabled && popoverTargets.length > 0;

  return (
    <AssistantPopoverContext.Provider value={popoverContextValue}>
      <div className={styles.container}>
        <ElementSelectionContext.Provider value={selectionContext}>
          <div className={styles.controlsWrapperSticky} onPointerDown={onClearSelection}>
            {controls}
          </div>
          {renderBody()}
          {showPopover && <ViewModePanelPromptCard targets={popoverTargets} onClose={clearPopover} />}
        </ElementSelectionContext.Provider>
      </div>
    </AssistantPopoverContext.Provider>
  );
}

function useUpdateAppChromeBreadcrumbActions(dashboard: DashboardScene) {
  const { chrome } = useGrafana();
  const { uid, isEditing, editview, editPanel, viewPanel, meta } = dashboard.useState();

  useLayoutEffect(() => {
    chrome.update({ breadcrumbActions: <BreadcrumbActions dashboard={dashboard} /> });

    return () => {
      chrome.update({ breadcrumbActions: undefined });
    };
  }, [
    chrome,
    dashboard,
    uid,
    isEditing,
    editview,
    editPanel,
    viewPanel,
    meta.canStar,
    meta.canEdit,
    meta.isSnapshot,
    meta.isEmbedded,
    meta.url,
  ]);
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

function getStyles(theme: GrafanaTheme2, headerHeight: number) {
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
      overflow: 'hidden',

      [theme.breakpoints.down('sm')]: {
        flex: 1,

        '> div:nth-child(2)': {
          zIndex: theme.zIndex.activePanel,
        },
      },
    }),
    bodyWrapperKiosk: css({
      padding: theme.spacing(0, 2, 2, 2),
      overflow: 'unset',
    }),
    scrollContainer: css({
      display: 'flex',
      flexDirection: 'column',
      flexGrow: 1,
      minHeight: 0,
      overflow: 'auto',
      scrollbarWidth: 'thin',
      scrollbarGutter: 'stable',
      // without top padding the fixed controls headers is rendered over the selection outline.
      padding: theme.spacing(0.125, 1, 2, 2),
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
      // without top padding the fixed controls headers is rendered over the selection outline.
      padding: theme.spacing(0.125, 2, 2, 2),
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
      // Because the edit pane splitter handle area adds padding we can reduce it here
      paddingRight: theme.spacing(1),
    }),
    controlsWrapperSticky: css({
      [theme.breakpoints.up('md')]: {
        position: 'sticky',
        // above docked dashboard edit Sidebar (zIndex navBarFixed); otherwise time picker popover stays under it.
        zIndex: theme.zIndex.sidemenu,
        background: theme.colors.background.canvas,
        top: headerHeight,
      },
    }),
  };
}
