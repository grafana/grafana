import { useEffect, useMemo, useState } from 'react';

import { type DataTransformerConfig, DataTransformerID, type PanelData, transformDataFrame } from '@grafana/data';
import { useObservable } from '@grafana/data/unstable';
import { useFlagGrafanaViewPanelPane } from '@grafana/runtime/internal';
import { type SceneDataProvider, type VizPanel, useSceneObjectState } from '@grafana/scenes';
import { SceneContext, SceneContextObject } from '@grafana/scenes-react';
import { Spinner } from '@grafana/ui';
import { useMediaQueryMinWidth } from 'app/core/hooks/useMediaQueryMinWidth';

import { getDashboardSceneLike } from '../scene/types/dashboard';
import { ToggleViewPanePaneEvent } from '../sidebar/events';

import { FanoutPanel } from './FanoutPanel';
import { type AdhocTransformsState, ViewPanelSidePane } from './ViewPanelSidePane';

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
  const { fanoutMode, adhocTransforms } = useSceneObjectState(viewPanelPane, { shouldActivateOrKeepAlive: true });
  const [transformedData, adhocTransformsLoading] = useAdhocTransforms(data, adhocTransforms);

  // Open pane on mount
  useEffect(() => {
    if (!isSmallScreen) {
      sidebar.openPane(viewPanelPane);
    }
  }, [sidebar, isSmallScreen, viewPanelPane]);

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

  if (adhocTransformsLoading) {
    return <Spinner />;
  }

  if (!context || !data) {
    return <panel.Component model={panel} />;
  }

  return (
    <SceneContext.Provider value={context}>
      <FanoutPanel panel={panel} panelDataIn={transformedData} fanoutMode={fanoutMode} />
    </SceneContext.Provider>
  );
}

/**
 * Applies the ad-hoc transformations configured in the view panel side pane. The transformer
 * implementations are loaded lazily so the transformed series arrive after the first render,
 * hence the loading flag.
 */
export function useAdhocTransforms(
  data: PanelData | undefined,
  adhocTransforms?: AdhocTransformsState
): [PanelData | undefined, boolean] {
  const transformations = useMemo((): DataTransformerConfig[] => {
    if (!adhocTransforms?.organize) {
      return [];
    }

    return [{ id: DataTransformerID.organize, options: adhocTransforms.organize }];
  }, [adhocTransforms]);

  const transformed = useObservable(
    useMemo(() => transformDataFrame(transformations, data?.series ?? []), [transformations, data])
  );

  if (!data || transformations.length === 0) {
    return [data, false];
  }

  if (!transformed) {
    return [data, true];
  }

  return [{ ...data, series: transformed }, false];
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
