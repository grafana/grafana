import { useState, useEffect } from 'react';

import { VizPanel, UrlSyncManager } from '@grafana/scenes';

import { DashboardScene } from '../scene/DashboardScene';
import { DashboardRepeatsProcessedEvent } from '../scene/types/DashboardRepeatsProcessedEvent';
import { containsPathIdSeparator } from '../utils/pathId';
import { findVizPanelByKey } from '../utils/utils';

export function useSoloPanel(dashboard: DashboardScene, panelId: string): [VizPanel | undefined, string | undefined] {
  const [panel, setPanel] = useState<VizPanel>();
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    const urlSyncManager = new UrlSyncManager();
    urlSyncManager.initSync(dashboard);

    const cleanUp = dashboard.activate();

    let panel: VizPanel | null = null;
    try {
      panel = findVizPanelByKey(dashboard, panelId);
    } catch (e) {
      // do nothing, just the panel is not found or not a VizPanel
    }

    if (panel) {
      activateParents(panel);
      setPanel(panel);
    } else if (containsPathIdSeparator(panelId)) {
      findRepeatClone(dashboard, panelId).then((panel) => {
        if (panel) {
          setPanel(panel);
        } else {
          setError('Panel not found');
        }
      });
    } else {
      setError('Panel not found');
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
        dashboard.state.body.activateRepeaters?.();
      }
    });

    dashboard.state.body.activateRepeaters?.();
  });
}
