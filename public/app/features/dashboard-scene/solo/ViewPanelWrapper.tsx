import { css } from '@emotion/css';
import { useEffect, useMemo, useState } from 'react';

import { useFlagGrafanaPanelHoverActions, useFlagGrafanaViewPanelPane } from '@grafana/runtime/internal';
import { type SceneDataProvider, type VizPanel, useSceneObjectState } from '@grafana/scenes';
import { SceneContext, SceneContextObject } from '@grafana/scenes-react';
import { useStyles2 } from '@grafana/ui';
import { useMediaQueryMinWidth } from 'app/core/hooks/useMediaQueryMinWidth';

import { PanelHoverActionsWrapper } from '../scene/edit-actions-popover/PanelHoverActions';
import { getDashboardSceneLike } from '../scene/types/dashboard';
import { ToggleViewPanePaneEvent } from '../sidebar/events';

import { FanoutPanel } from './FanoutPanel';
import { ViewPanelSidePane } from './ViewPanelSidePane';

export function ViewPanelWrapper({ panel, showControlsPane }: { panel: VizPanel; showControlsPane?: boolean }) {
  const hoverActions = useFlagGrafanaPanelHoverActions();
  const styles = useStyles2(getStyles);
  const content = <ViewPanelContent panel={panel} showControlsPane={showControlsPane} />;

  if (!hoverActions || !showControlsPane) {
    return content;
  }

  return (
    <PanelHoverActionsWrapper panel={panel} isViewPanel>
      <div className={styles.hoverActionsReference}>{content}</div>
    </PanelHoverActionsWrapper>
  );
}

function ViewPanelContent({ panel, showControlsPane }: { panel: VizPanel; showControlsPane?: boolean }) {
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

const getStyles = () => ({
  hoverActionsReference: css({
    display: 'flex',
    flexGrow: 1,
    position: 'relative',
    width: '100%',
    height: '100%',
  }),
});
