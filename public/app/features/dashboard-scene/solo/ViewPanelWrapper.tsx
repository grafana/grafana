import { useEffect, useMemo, useState } from 'react';

import { useFlagGrafanaViewPanelPane } from '@grafana/runtime/internal';
import { type SceneDataProvider, type VizPanel, useSceneObjectState } from '@grafana/scenes';
import { SceneContext, SceneContextObject } from '@grafana/scenes-react';
import { useMediaQueryMinWidth } from 'app/core/hooks/useMediaQueryMinWidth';

import { ToggleViewPanePaneEvent } from '../edit-pane/events';
import { getDashboardSceneLike } from '../scene/types/dashboard';

import { FanoutPanel } from './FanoutPanel';
import { ViewPanelSidePane } from './ViewPanelSidePane';

interface ViewPanelProps {
  panel: VizPanel;
}

export function ViewPanelWrapper({ panel }: ViewPanelProps) {
  const viewPanelPane = useFlagGrafanaViewPanelPane();
  if (!viewPanelPane || !panel.state.$data) {
    return <panel.Component model={panel} />;
  }

  return <ViewPanelWithPane panel={panel} />;
}

function ViewPanelWithPane({ panel }: ViewPanelProps) {
  const dashboard = getDashboardSceneLike(panel);
  const { editPane } = dashboard.useState();
  const { $data } = useSceneObjectState(panel, { shouldActivateOrKeepAlive: true });
  const context = usePanelSceneContextObject(panel);
  const isSmallScreen = !useMediaQueryMinWidth('sm');
  const viewPanelPane = useMemo(() => new ViewPanelSidePane({ panelRef: panel.getRef() }), [panel]);
  const { fanoutMode } = useSceneObjectState(viewPanelPane, { shouldActivateOrKeepAlive: true });

  // Open pane on mount
  useEffect(() => {
    if (!isSmallScreen) {
      editPane.openPane(viewPanelPane);
    }
  }, [editPane, isSmallScreen, viewPanelPane]);

  // Handle manual toggling of the pane via the edit pane buttons
  // This is done via an event that sidebar pane button publishes as the ViewPanelSidePane instance & panel ref is only available from this component
  useEffect(() => {
    const sub = editPane.subscribeToEvent(ToggleViewPanePaneEvent, () => {
      if (editPane.state.openPane === viewPanelPane) {
        editPane.closePane();
      } else {
        editPane.openPane(viewPanelPane);
      }
    });

    return () => sub.unsubscribe();
  }, [viewPanelPane, editPane]);

  // $data might be undefined when skipDataQuery=true, e.g. in TextPanel
  // see also: createPanelDataProvider.ts
  if (!context || !$data || !fanoutMode) {
    return <panel.Component model={panel} />;
  }

  return <FanoutPanelWrapper panel={panel} dataProvider={$data} context={context} fanoutMode={fanoutMode} />;
}

interface FanoutPanelWrapperProps {
  panel: VizPanel;
  dataProvider: SceneDataProvider;
  context: SceneContextObject;
  fanoutMode: string;
}

function FanoutPanelWrapper({ panel, dataProvider, context, fanoutMode }: FanoutPanelWrapperProps) {
  const { data } = dataProvider.useState();

  if (!data) {
    return <panel.Component model={panel} />;
  }

  return (
    <SceneContext.Provider value={context}>
      <FanoutPanel panel={panel} panelDataIn={data} fanoutMode={fanoutMode} />
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
