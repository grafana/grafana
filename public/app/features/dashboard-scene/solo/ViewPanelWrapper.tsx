import { useEffect, useMemo, useState } from 'react';

import { store } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { useFlagGrafanaViewPanelPane } from '@grafana/runtime/internal';
import { type SceneDataProvider, type VizPanel, useSceneObjectState } from '@grafana/scenes';
import { SceneContext, SceneContextObject } from '@grafana/scenes-react';
import { useMediaQueryMinWidth } from 'app/core/hooks/useMediaQueryMinWidth';

import { getDashboardSceneLike } from '../scene/types/dashboard';
import { ToggleViewPanePaneEvent } from '../sidebar/events';

import { FanoutPanel } from './FanoutPanel';
import { ViewPanelSidePane } from './ViewPanelSidePane';

export const VIEW_PANEL_PANE_CLOSED_KEY = 'grafana.dashboard.sidebar.viewPanelPane.closed';

export function ViewPanelWrapper({ panel, showControlsPane }: { panel: VizPanel; showControlsPane?: boolean }) {
  const viewPanelPane = useFlagGrafanaViewPanelPane();
  const { $data } = useSceneObjectState(panel, { shouldActivateOrKeepAlive: true });

  if (!viewPanelPane || !$data || !showControlsPane) {
    return <panel.Component model={panel} />;
  }

  return <ViewPanelWithPane panel={panel} dataProvider={$data} />;
}

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

  // Remember open / closed so the user's last choice is the default for the next panel view.
  // Closes that happen when leaving view mode are programmatic (viewPanel is cleared first) and must not count.
  useEffect(() => {
    const sub = sidebar.subscribeToState((newState, prevState) => {
      if (newState.openPane === prevState.openPane) {
        return;
      }

      if (newState.openPane === viewPanelPane) {
        store.set(VIEW_PANEL_PANE_CLOSED_KEY, false);
      } else if (prevState.openPane === viewPanelPane && dashboard.state.viewPanel) {
        store.set(VIEW_PANEL_PANE_CLOSED_KEY, true);
      }
    });

    return () => sub.unsubscribe();
  }, [sidebar, viewPanelPane, dashboard]);

  // Handle manual toggling of the pane via the sidebar buttons
  // This is done via an event that sidebar pane button publishes as the ViewPanelSidePane instance & panel ref is only available from this component
  useEffect(() => {
    const sub = sidebar.subscribeToEvent(ToggleViewPanePaneEvent, () => {
      if (sidebar.state.openPane === viewPanelPane) {
        sidebar.closePane();
      } else {
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
