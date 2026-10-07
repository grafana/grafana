import { urlUtil } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { DashboardScene } from 'app/features/dashboard-scene/scene/DashboardScene';
import { isRepeatCloneOrChildOf } from 'app/features/dashboard-scene/utils/clone';
import { findVizPanelByKey } from 'app/features/dashboard-scene/utils/findVizPanel';
import { focusVizPanel } from 'app/features/dashboard-scene/utils/focusPanel';
import { tryGetExploreUrlForPanel } from 'app/features/dashboard-scene/utils/urlBuilders';
import { getVizPanelKeyForPanelId } from 'app/features/dashboard-scene/utils/utils-panels';

import { type RenderLinkTarget } from './runtime';

/** Follows a link that validateRenderLink accepted. Panel actions resolve the panel from this dashboard. */
export async function followLink(target: RenderLinkTarget): Promise<void> {
  switch (target.kind) {
    case 'view-panel':
      locationService.partial({ viewPanel: `panel-${target.panelId}` });
      return;
    case 'dashboard-state':
      if (target.params.editPanel !== undefined && !canEditPanel(String(target.params.editPanel))) {
        return;
      }
      locationService.partial(target.params);
      return;
    case 'dashboard':
      locationService.push(urlUtil.renderUrl(target.path, target.params));
      return;
    case 'explore-panel': {
      const panel = findPanel(target.panelId);
      // Same URL as the panel menu's Explore item; undefined without Explore access or queries.
      const url = panel ? await tryGetExploreUrlForPanel(panel) : undefined;
      if (url) {
        locationService.push(url);
      }
      return;
    }
    case 'focus-panel': {
      const panel = findPanel(target.panelId);
      if (panel) {
        focusVizPanel(panel);
      }
      return;
    }
  }
}

function getDashboard(): DashboardScene | undefined {
  const scene = window.__grafanaSceneContext;
  return scene instanceof DashboardScene ? scene : undefined;
}

function findPanel(panelId: number) {
  const dashboard = getDashboard();
  return dashboard ? findVizPanelByKey(dashboard, getVizPanelKeyForPanelId(panelId)) : null;
}

/** The checks of the panel menu's Edit item. */
function canEditPanel(panelKey: string): boolean {
  const dashboard = getDashboard();
  if (!dashboard || !dashboard.canEditDashboard() || !dashboard.state.editable || dashboard.state.editPanel) {
    return false;
  }
  const panel = findVizPanelByKey(dashboard, panelKey);
  return panel !== null && !isRepeatCloneOrChildOf(panel);
}
