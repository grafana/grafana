import { useState, useEffect } from 'react';

import { VizPanel, SceneObject, SceneGridRow, getUrlSyncManager } from '@grafana/scenes';

import { DashboardScene } from '../scene/DashboardScene';
import { PanelRepeaterGridItem } from '../scene/PanelRepeaterGridItem';
import { RowRepeaterBehavior } from '../scene/RowRepeaterBehavior';
import { DashboardRepeatsProcessedEvent } from '../scene/types';
import { findVizPanelByKey, isPanelClone } from '../utils/utils';

export function useSoloPanel(dashboard: DashboardScene, panelId: string): [VizPanel | undefined, string | undefined] {
  const [panel, setPanel] = useState<VizPanel>();
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    getUrlSyncManager().initSync(dashboard);

    const cleanUp = dashboard.activate();

    const panel = findVizPanelByKey(dashboard, panelId);
    if (panel) {
      activateParents(panel);
      setPanel(panel);
    } else if (isPanelClone(panelId)) {
      findRepeatClone(dashboard, panelId).then((panel) => {
        if (panel) {
          setPanel(panel);
        } else {
          setError('Panel not found');
        }
      });
    }

    return cleanUp;
  }, [dashboard, panelId]);

  return [panel, error];
}

function activateParents(panel: VizPanel) {
  let parent = panel.parent;

  while (parent && !parent.isActive) {
    parent.activate();
    parent = parent.parent;
  }
}

function findRepeatClone(dashboard: DashboardScene, panelId: string): Promise<VizPanel | undefined> {
  return new Promise((resolve) => {
    dashboard.subscribeToEvent(DashboardRepeatsProcessedEvent, () => {
      const panel = findVizPanelByKey(dashboard, panelId);
      if (panel) {
        resolve(panel);
      } else {
        // If rows are repeated they could add new panel repeaters that needs to be activated
        activateAllRepeaters(dashboard.state.body);
      }
    });

    activateAllRepeaters(dashboard.state.body);
  });
}

function activateAllRepeaters(layout: SceneObject) {
  layout.forEachChild((child) => {
    if (child instanceof PanelRepeaterGridItem && !child.isActive) {
      child.activate();
      return;
    }

    if (child instanceof SceneGridRow && child.state.$behaviors) {
      for (const behavior of child.state.$behaviors) {
        if (behavior instanceof RowRepeaterBehavior && !child.isActive) {
          child.activate();
          break;
        }
      }

      // Activate any panel PanelRepeaterGridItem inside the row
      activateAllRepeaters(child);
    }
  });
}
