import { css } from '@emotion/css';
import { useEffect, useMemo, useState } from 'react';

import { store } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { useFlagGrafanaPanelActionsPopover, useFlagGrafanaViewPanelPane } from '@grafana/runtime/internal';
import { type SceneDataProvider, type VizPanel, useSceneObjectState } from '@grafana/scenes';
import { SceneContext, SceneContextObject } from '@grafana/scenes-react';
import { useMediaQueryMinWidth } from 'app/core/hooks/useMediaQueryMinWidth';

import { PanelActionsWrapper } from '../scene/edit-actions-popover/PanelActionsPopover';
import { getDashboardSceneLike } from '../scene/types/dashboard';
import { PaneClosedEvent, ToggleViewPanePaneEvent } from '../sidebar/events';

import { FanoutPanel } from './FanoutPanel';
import { hasViewPanelPaneContent, ViewPanelSidePane } from './ViewPanelSidePane';

export const VIEW_PANEL_PANE_CLOSED_KEY = 'grafana.dashboard.sidebar.viewPanelPane.closed';

export function ViewPanelWrapper({ panel, showControlsPane }: { panel: VizPanel; showControlsPane?: boolean }) {
  const viewPanelPane = useFlagGrafanaViewPanelPane();
  const isActionsPopoverEnabled = useFlagGrafanaPanelActionsPopover();
  const { $data } = useSceneObjectState(panel, { shouldActivateOrKeepAlive: true });
  // With the actions popover, the pane no longer holds a "Back to dashboard" button, so it is only opened when the
  // panel plugin has controls to show in it.
  const hasPaneContent = !isActionsPopoverEnabled || hasViewPanelPaneContent(panel);

  const content =
    !viewPanelPane || !$data || !showControlsPane || !hasPaneContent ? (
      <panel.Component model={panel} />
    ) : (
      <ViewPanelWithPane panel={panel} dataProvider={$data} />
    );

  if (isActionsPopoverEnabled && showControlsPane) {
    return (
      <PanelActionsWrapper panel={panel}>
        <div className={viewPanelContainer}>{content}</div>
      </PanelActionsWrapper>
    );
  }

  return content;
}

const viewPanelContainer = css({
  display: 'flex',
  flexGrow: 1,
  position: 'relative',
  width: '100%',
  height: '100%',
});

function ViewPanelWithPane({ panel, dataProvider }: { panel: VizPanel; dataProvider: SceneDataProvider }) {
  const dashboard = getDashboardSceneLike(panel);
  const { sidebar } = dashboard.useState();
  const { data } = dataProvider.useState();
  const context = usePanelSceneContextObject(panel);
  const isSmallScreen = !useMediaQueryMinWidth('sm');
  const viewPanelPane = useMemo(() => new ViewPanelSidePane({ panelRef: panel.getRef() }), [panel]);
  const { fanoutMode } = useSceneObjectState(viewPanelPane, { shouldActivateOrKeepAlive: true });

  // Open pane on mount, unless the user closed it the last time it was open. A fanout url param
  // always opens the pane as the pane's url sync is only registered while it is open.
  useEffect(() => {
    const hasFanoutInUrl = Boolean(locationService.getSearchObject().fanout);

    if (!isSmallScreen && (hasFanoutInUrl || !store.getBool(VIEW_PANEL_PANE_CLOSED_KEY, false))) {
      sidebar.openPane(viewPanelPane);
    }
  }, [sidebar, isSmallScreen, viewPanelPane]);

  // Remember an explicit close so it is the default for the next panel view. A click-away close
  // (undocked mode) is not a choice about the pane: the pointer was aimed at something else, and
  // may be about to leave view mode. Programmatic closes (the default reason, e.g. a dashboard
  // rebuild or leaving view mode) are not the user's choice and do not count either.
  useEffect(() => {
    const sub = sidebar.subscribeToEvent(PaneClosedEvent, ({ payload }) => {
      if (payload.pane === viewPanelPane && payload.reason === 'explicit' && dashboard.state.viewPanel) {
        store.set(VIEW_PANEL_PANE_CLOSED_KEY, true);
      }
    });

    return () => sub.unsubscribe();
  }, [sidebar, viewPanelPane, dashboard]);

  // Handle manual toggling of the pane via the sidebar buttons
  // This is done via an event that sidebar pane button publishes as the ViewPanelSidePane instance & panel ref is only available from this component
  // Opening it this way is the only thing that restores the automatic opening.
  useEffect(() => {
    const sub = sidebar.subscribeToEvent(ToggleViewPanePaneEvent, () => {
      if (sidebar.state.openPane === viewPanelPane) {
        sidebar.closePane('explicit');
      } else {
        store.set(VIEW_PANEL_PANE_CLOSED_KEY, false);
        sidebar.openPane(viewPanelPane);
      }
    });

    return () => sub.unsubscribe();
  }, [viewPanelPane, sidebar]);

  if (!context || !data || !fanoutMode) {
    return <panel.Component model={panel} />;
  }

  return (
    <SceneContext.Provider value={context}>
      <FanoutPanel panel={panel} panelDataIn={data!} fanoutMode={fanoutMode} />
    </SceneContext.Provider>
  );
}

function usePanelSceneContextObject(panel: VizPanel) {
  const [context, setContext] = useState<SceneContextObject | null>(null);

  /**
   * Attach SceneContextObject to the panel on mount for any dynamically rendered scenes-react panels
   */
  useEffect(() => {
    const newContext = new SceneContextObject();
    // @ts-expect-error
    panel.setState({ context: newContext });
    setContext(newContext);

    return () => {
      // @ts-expect-error
      panel.setState({ context: null });
      setContext(null);
    };
  }, [panel]);

  return context;
}
