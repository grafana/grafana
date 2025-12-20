import { isEqual } from 'lodash';

import { RefreshEvent, config, locationService, type DashboardSceneJsonApiV2 } from '@grafana/runtime';
import {
  MultiValueVariable,
  TextBoxVariable,
  sceneGraph,
  type SceneObject,
  type VariableValue,
} from '@grafana/scenes';

import { getDashboardScenePageStateManager } from '../pages/DashboardScenePageStateManager';
import { AutoGridItem } from '../scene/layout-auto-grid/AutoGridItem';
import { DashboardGridItem } from '../scene/layout-default/DashboardGridItem';
import { RowItem } from '../scene/layout-rows/RowItem';
import { TabItem } from '../scene/layout-tabs/TabItem';
import { TabsLayoutManager } from '../scene/layout-tabs/TabsLayoutManager';
import { dashboardSceneGraph } from '../utils/dashboardSceneGraph';
import { getPanelIdForVizPanel, getQueryRunnerFor } from '../utils/utils';

import { getCurrentDashboardErrors } from './currentDashboardErrors';
import { getCurrentDashboardKindV2 as getCurrentDashboardResourceV2 } from './currentDashboardKindV2';
import { applyCurrentDashboardSpecV2 } from './currentDashboardSpecApplyV2';

type DashboardResourceV2 = ReturnType<typeof getCurrentDashboardResourceV2>;

/**
 * The dashboard JSON API is required to be resilient for automation.
 *
 * In practice, the currently loaded `DashboardScene` might temporarily be in a state that cannot be
 * serialized back to a v2 resource (for example, if the scene contains unsupported transformation types).
 *
 * To avoid “bricking” the API in that situation (where both `getCurrentDashboard()` and
 * `applyCurrentDashboard()` would fail because they need to read the current resource),
 * we keep a last-known-good dashboard resource cached as a recovery fallback.
 */
let lastKnownGoodResource: DashboardResourceV2 | undefined;

function assertDashboardV2Enabled() {
  const isKubernetesDashboardsEnabled = Boolean(config.featureToggles.kubernetesDashboards);
  const isV2Enabled = Boolean(config.featureToggles.kubernetesDashboardsV2 || config.featureToggles.dashboardNewLayouts);

  if (!isKubernetesDashboardsEnabled || !isV2Enabled) {
    throw new Error('V2 dashboard kinds API requires kubernetes dashboards v2 to be enabled');
  }
}

function getCurrentDashboardSceneOrThrow() {
  const mgr = getDashboardScenePageStateManager();
  const dashboard = mgr.state.dashboard;
  if (!dashboard) {
    throw new Error('No dashboard is currently open');
  }
  return dashboard;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function findParent<T extends SceneObject>(start: SceneObject, isMatch: (obj: SceneObject) => obj is T): T | null {
  let cur: SceneObject | undefined = start.parent ?? undefined;
  while (cur) {
    if (isMatch(cur)) {
      return cur;
    }
    cur = cur.parent;
  }
  return null;
}

function getDashboardUidFromUrl(): string | undefined {
  const pathname = globalThis.location?.pathname ?? '';
  // Expected: /d/<uid>/<slug>
  const match = pathname.match(/\/d\/([^/]+)/);
  return match?.[1];
}

function getCurrentDashboardResourceWithFallback(): { resource: DashboardResourceV2; source: 'live' | 'cache' } {
  try {
    const resource = getCurrentDashboardResourceV2();
    lastKnownGoodResource = resource;
    return { resource, source: 'live' };
  } catch (err) {
    if (lastKnownGoodResource) {
      return { resource: lastKnownGoodResource, source: 'cache' };
    }

    const details = err instanceof Error ? err.message : String(err);
    throw new Error(
      'DashboardScene JSON API could not read the current dashboard resource. ' +
        'This can happen if the loaded DashboardScene cannot be serialized to schema v2. ' +
        'To recover, call applyCurrentDashboard() with a valid v2beta1 Dashboard JSON (spec-only changes) ' +
        'whose metadata.name matches the dashboard UID in the URL.\n\n' +
        `Underlying error: ${details}`
    );
  }
}

export const dashboardSceneJsonApiV2: DashboardSceneJsonApiV2 = {
  getCurrentDashboard: (space = 2) => {
    const { resource } = getCurrentDashboardResourceWithFallback();
    return JSON.stringify(resource, null, space);
  },

  getCurrentDashboardErrors: (space = 2) => {
    return JSON.stringify(getCurrentDashboardErrors(), null, space);
  },

  getCurrentDashboardVariables: (space = 2) => {
    assertDashboardV2Enabled();
    const dashboard = getCurrentDashboardSceneOrThrow();
    const vars = dashboard.state.$variables?.state.variables ?? [];

    const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
    const variables = vars.map((v) => ({ name: v.state.name, value: v.getValue() })).sort((a, b) => collator.compare(a.name, b.name));

    return JSON.stringify({ variables }, null, space);
  },

  applyCurrentDashboardVariables: (varsJson: string) => {
    assertDashboardV2Enabled();
    const dashboard = getCurrentDashboardSceneOrThrow();
    const vars = dashboard.state.$variables?.state.variables ?? [];
    const parsed: unknown = JSON.parse(varsJson);
    const parsedObj: Record<string, unknown> = isRecord(parsed) ? parsed : {};

    // Accept either { variables: [{ name, value }] } or { [name]: value }
    const variablesProp = parsedObj['variables'];
    const entries: Array<{ name: unknown; value: unknown }> = Array.isArray(variablesProp)
      ? variablesProp
      : Object.entries(parsedObj).map(([name, value]) => ({ name, value }));

    for (const entry of entries) {
      const name = entry.name;
      const value = entry.value;
      if (typeof name !== 'string' || name.length === 0) {
        continue;
      }
      if (!(typeof value === 'string' || Array.isArray(value))) {
        continue;
      }

      const variable = vars.find((v) => v.state.name === name);
      if (!variable) {
        continue;
      }

      let varValue: VariableValue | undefined;
      if (typeof value === 'string') {
        varValue = value;
      } else if (Array.isArray(value) && value.every((v) => typeof v === 'string')) {
        varValue = value;
      }

      if (!varValue) {
        continue;
      }

      if (variable instanceof MultiValueVariable) {
        variable.changeValueTo(varValue, varValue, true);
      } else if (variable instanceof TextBoxVariable && typeof varValue === 'string') {
        variable.setValue(varValue);
      } else {
        // Unsupported variable type for programmatic update (for now).
        continue;
      }

      locationService.partial({ [`var-${name}`]: varValue }, true);
    }

    // Force rerun queries and refresh panels.
    dashboard.publishEvent(new RefreshEvent(), true);
  },

  getCurrentDashboardTimeRange: (space = 2) => {
    assertDashboardV2Enabled();
    const dashboard = getCurrentDashboardSceneOrThrow();
    const tr = sceneGraph.getTimeRange(dashboard);
    const timezone = tr.state.timeZone ?? tr.getTimeZone();
    return JSON.stringify({ from: tr.state.from, to: tr.state.to, timezone }, null, space);
  },

  applyCurrentDashboardTimeRange: (timeRangeJson: string) => {
    assertDashboardV2Enabled();
    const dashboard = getCurrentDashboardSceneOrThrow();
    const tr = sceneGraph.getTimeRange(dashboard);
    const parsed: unknown = JSON.parse(timeRangeJson);
    const parsedObj: Record<string, unknown> = isRecord(parsed) ? parsed : {};

    const from = parsedObj['from'];
    const to = parsedObj['to'];
    const timezone = parsedObj['timezone'];

    if (typeof timezone === 'string' && timezone.length) {
      tr.onTimeZoneChange(timezone);
    }

    if (typeof from !== 'string' || typeof to !== 'string') {
      throw new Error('Invalid time range JSON: expected { from: string, to: string, timezone?: string }');
    }

    tr.onTimeRangeChange({ ...tr.state.value, raw: { from, to } });
    tr.onRefresh();
  },

  selectCurrentDashboardTab: (tabJson: string) => {
    assertDashboardV2Enabled();
    const dashboard = getCurrentDashboardSceneOrThrow();
    const tabReq: unknown = JSON.parse(tabJson);
    const tabObj: Record<string, unknown> = isRecord(tabReq) ? tabReq : {};
    const title = typeof tabObj['title'] === 'string' ? tabObj['title'] : undefined;
    const slug = typeof tabObj['slug'] === 'string' ? tabObj['slug'] : undefined;

    const found = dashboard.state.body instanceof TabsLayoutManager ? dashboard.state.body : sceneGraph.findObject(dashboard, (o) => o instanceof TabsLayoutManager);
    const tabsManager = found instanceof TabsLayoutManager ? found : null;
    if (!tabsManager) {
      throw new Error('No tab layout is active for the current dashboard');
    }

    const tabs = tabsManager.getTabsIncludingRepeats();
    const tab = tabs.find((t) => (slug ? t.getSlug() === slug : false) || (title ? t.state.title === title : false));
    if (!tab?.state.key) {
      throw new Error('Tab not found');
    }

    // NOTE: `forceSelectTab` also selects the tab in the edit pane (opens the edit UI).
    // The API must not trigger edit selection when navigating.
    tabsManager.switchToTab(tab);
    locationService.partial({ [tabsManager.getUrlKey()]: tab.getSlug() }, true);
  },

  getCurrentDashboardNavigation: (space = 2) => {
    assertDashboardV2Enabled();
    const dashboard = getCurrentDashboardSceneOrThrow();

    const found = dashboard.state.body instanceof TabsLayoutManager ? dashboard.state.body : sceneGraph.findObject(dashboard, (o) => o instanceof TabsLayoutManager);
    const tabsManager = found instanceof TabsLayoutManager ? found : null;

    if (!tabsManager) {
      return JSON.stringify({ tab: null }, null, space);
    }

    const currentTab = tabsManager.getCurrentTab();
    if (!currentTab) {
      return JSON.stringify({ tab: null }, null, space);
    }

    return JSON.stringify(
      {
        tab: {
          slug: currentTab.getSlug(),
          title: currentTab.state.title,
        },
      },
      null,
      space
    );
  },

  focusCurrentDashboardRow: (rowJson: string) => {
    assertDashboardV2Enabled();
    const dashboard = getCurrentDashboardSceneOrThrow();
    const req: unknown = JSON.parse(rowJson);
    const reqObj: Record<string, unknown> = isRecord(req) ? req : {};
    const title = typeof reqObj['title'] === 'string' ? reqObj['title'] : undefined;
    const rowKey = typeof reqObj['rowKey'] === 'string' ? reqObj['rowKey'] : undefined;

    const rows = sceneGraph.findAllObjects(dashboard, (o) => o instanceof RowItem).filter((o): o is RowItem => o instanceof RowItem);
    const row = rows.find((r) => (rowKey ? r.state.key === rowKey : false) || (title ? r.state.title === title : false));
    if (!row) {
      throw new Error('Row not found');
    }

    const tab = findParent(row, (o): o is TabItem => o instanceof TabItem);
    const tabsManager = tab ? findParent(tab, (o): o is TabsLayoutManager => o instanceof TabsLayoutManager) : null;
    if (tab?.state.key && tabsManager) {
      tabsManager.switchToTab(tab);
      locationService.partial({ [tabsManager.getUrlKey()]: tab.getSlug() }, true);
    }

    if (row.state.collapse) {
      row.setCollapsedState(false);
    }
    row.scrollIntoView();
  },

  focusCurrentDashboardPanel: (panelJson: string) => {
    assertDashboardV2Enabled();
    const dashboard = getCurrentDashboardSceneOrThrow();
    const req: unknown = JSON.parse(panelJson);
    const reqObj: Record<string, unknown> = isRecord(req) ? req : {};
    const panelId = reqObj['panelId'];
    if (typeof panelId !== 'number') {
      throw new Error('Invalid panel JSON: expected { panelId: number }');
    }

    const vizPanel = dashboardSceneGraph.getVizPanels(dashboard).find((p) => getPanelIdForVizPanel(p) === panelId);
    if (!vizPanel) {
      throw new Error('Panel not found');
    }

    // Ensure containing tab is active, if any.
    const tab = findParent(vizPanel, (o): o is TabItem => o instanceof TabItem);
    const tabsManager = tab ? findParent(tab, (o): o is TabsLayoutManager => o instanceof TabsLayoutManager) : null;
    if (tab?.state.key && tabsManager) {
      tabsManager.switchToTab(tab);
      locationService.partial({ [tabsManager.getUrlKey()]: tab.getSlug() }, true);
    }

    // Ensure containing row is expanded, if any.
    const row = findParent(vizPanel, (o): o is RowItem => o instanceof RowItem);
    if (row?.state.collapse) {
      row.setCollapsedState(false);
    }

    // Scroll nearest known layout item that supports scrollIntoView.
    const gridItem = findParent(vizPanel, (o): o is DashboardGridItem => o instanceof DashboardGridItem);
    const autoGridItem = findParent(vizPanel, (o): o is AutoGridItem => o instanceof AutoGridItem);
    (gridItem ?? autoGridItem)?.scrollIntoView();

    // Best-effort rerun queries for this panel if it has a runner.
    const runner = getQueryRunnerFor(vizPanel);
    runner?.runQueries?.();
  },

  applyCurrentDashboard: (resourceJson: string) => {
    const resource = JSON.parse(resourceJson);
    let current: DashboardResourceV2 | undefined;
    try {
      // Prefer live for strict immutability checks, but fall back to cached baseline.
      current = getCurrentDashboardResourceV2();
      lastKnownGoodResource = current;
    } catch {
      current = lastKnownGoodResource;
    }

    // If we can’t read the current resource at all (no cache), we still allow recovery by validating
    // that the caller targets the currently open dashboard, and that the payload is a v2beta1 Dashboard.
    if (!current) {
      const uidFromUrl = getDashboardUidFromUrl();

      if (resource.apiVersion !== 'dashboard.grafana.app/v2beta1') {
        throw new Error('Changing apiVersion is not allowed');
      }
      if (resource.kind !== 'Dashboard') {
        throw new Error('Changing kind is not allowed');
      }
      if (!resource.metadata || typeof resource.metadata !== 'object') {
        throw new Error('Changing metadata is not allowed');
      }
      if (uidFromUrl && resource.metadata.name !== uidFromUrl) {
        throw new Error('Changing metadata is not allowed');
      }
      if (!('status' in resource)) {
        // Keep error message consistent; callers should include status even if empty.
        throw new Error('Changing status is not allowed');
      }

      applyCurrentDashboardSpecV2(resource.spec);
      // Best-effort refresh cache after recovery.
      try {
        lastKnownGoodResource = getCurrentDashboardResourceV2();
      } catch {
        // ignore
      }
      return;
    }

    if (!isEqual(resource.apiVersion, current.apiVersion)) {
      throw new Error('Changing apiVersion is not allowed');
    }
    if (!isEqual(resource.kind, current.kind)) {
      throw new Error('Changing kind is not allowed');
    }
    if (!isEqual(resource.metadata, current.metadata)) {
      throw new Error('Changing metadata is not allowed');
    }
    if (!isEqual(resource.status, current.status)) {
      throw new Error('Changing status is not allowed');
    }

    applyCurrentDashboardSpecV2(resource.spec);
    // Best-effort cache refresh after apply.
    try {
      lastKnownGoodResource = getCurrentDashboardResourceV2();
    } catch {
      // ignore
    }
  },
};


