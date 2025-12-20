import { isEqual } from 'lodash';

import { DataLink } from '@grafana/data';
import { RefreshEvent, config, locationService, type DashboardSceneJsonApiV2 } from '@grafana/runtime';
import {
  MultiValueVariable,
  SceneGridRow,
  SceneVariableSet,
  TextBoxVariable,
  sceneGraph,
  SceneDataTransformer,
  SceneQueryRunner,
  VizPanel,
  type SceneDataQuery,
  type SceneObject,
  type VariableValue,
} from '@grafana/scenes';

import { getDashboardScenePageStateManager } from '../pages/DashboardScenePageStateManager';
import { AutoGridItem } from '../scene/layout-auto-grid/AutoGridItem';
import { AutoGridLayoutManager } from '../scene/layout-auto-grid/AutoGridLayoutManager';
import { DashboardGridItem } from '../scene/layout-default/DashboardGridItem';
import { DefaultGridLayoutManager } from '../scene/layout-default/DefaultGridLayoutManager';
import { RowItem } from '../scene/layout-rows/RowItem';
import { RowsLayoutManager } from '../scene/layout-rows/RowsLayoutManager';
import { TabItem } from '../scene/layout-tabs/TabItem';
import { TabsLayoutManager } from '../scene/layout-tabs/TabsLayoutManager';
import { addNewRowTo } from '../scene/layouts-shared/addNew';
import { PanelTimeRange } from '../scene/panel-timerange/PanelTimeRange';
import { dashboardSceneGraph } from '../utils/dashboardSceneGraph';
import {
  getDefaultVizPanel,
  getGridItemKeyForPanelId,
  getLayoutManagerFor,
  getPanelIdForVizPanel,
  getQueryRunnerFor,
} from '../utils/utils';

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
  const isV2Enabled = Boolean(
    config.featureToggles.kubernetesDashboardsV2 || config.featureToggles.dashboardNewLayouts
  );

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

function removeVizPanelFromCurrentLayoutInPlace(panel: VizPanel) {
  const parent = panel.parent;
  if (!parent) {
    return;
  }

  if (parent instanceof AutoGridItem) {
    const mgr = findParent(parent, (o): o is AutoGridLayoutManager => o instanceof AutoGridLayoutManager);
    if (mgr) {
      mgr.state.layout.setState({ children: mgr.state.layout.state.children.filter((c) => c !== parent) });
      return;
    }
  }

  if (parent instanceof DashboardGridItem) {
    const mgr = findParent(parent, (o): o is DefaultGridLayoutManager => o instanceof DefaultGridLayoutManager);
    if (mgr) {
      mgr.state.grid.setState({ children: mgr.state.grid.state.children.filter((c) => c !== parent) });
      return;
    }
  }

  // Last resort: ask the layout manager abstraction (may require edit-pane plumbing).
  try {
    const mgr = getLayoutManagerFor(panel);
    mgr.removePanel?.(panel);
  } catch {
    // ignore
  }
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

function addVizPanelToLayoutInPlace(layout: unknown, panel: VizPanel, sourceGridItem?: DashboardGridItem) {
  if (layout instanceof AutoGridLayoutManager) {
    layout.state.layout.setState({
      children: [...layout.state.layout.state.children, new AutoGridItem({ body: panel })],
    });
    return;
  }

  if (layout instanceof DefaultGridLayoutManager) {
    const children = layout.state.grid.state.children;

    // Put it at the bottom.
    let nextY = 0;
    for (const child of children) {
      const childState = isRecord(child) ? child['state'] : undefined;
      const y = isRecord(childState) && typeof childState['y'] === 'number' ? childState['y'] : 0;
      const h = isRecord(childState) && typeof childState['height'] === 'number' ? childState['height'] : 0;
      nextY = Math.max(nextY, y + h);
    }

    const panelId = getPanelIdForVizPanel(panel);
    const width = sourceGridItem?.state.width ?? 24;
    const height = sourceGridItem?.state.height ?? 8;
    const x = 0;

    const key = sourceGridItem?.state.key ?? getGridItemKeyForPanelId(panelId);

    const newGridItem = new DashboardGridItem({
      x,
      y: nextY,
      width,
      height,
      body: panel,
      key,
    });

    layout.state.grid.setState({ children: [...children, newGridItem] });
    return;
  }

  throw new Error(`Unsupported layout type: ${layout instanceof Object ? layout.constructor?.name : typeof layout}`);
}

function toSelectedItem(
  obj: SceneObject,
  dashboard: ReturnType<typeof getCurrentDashboardSceneOrThrow>
): Record<string, unknown> {
  // Dashboard selection is represented as the dashboard instance itself.
  if (obj === dashboard) {
    return {
      type: 'dashboard',
      title: dashboard.state.title,
      key: dashboard.state.key,
    };
  }

  if (obj instanceof VizPanel) {
    return {
      type: 'panel',
      panelId: getPanelIdForVizPanel(obj),
      title: obj.state.title,
      pluginId: obj.state.pluginId,
      key: obj.state.key,
    };
  }

  if (obj instanceof RowItem) {
    return {
      type: 'row',
      rowKey: obj.state.key,
      title: obj.state.title,
    };
  }

  if (obj instanceof SceneGridRow) {
    return {
      type: 'row',
      rowKey: obj.state.key,
    };
  }

  if (obj instanceof TabItem) {
    return {
      type: 'tab',
      tabSlug: obj.getSlug(),
      title: obj.state.title,
      key: obj.state.key,
    };
  }

  if (obj instanceof SceneVariableSet) {
    return {
      type: 'variables',
      key: obj.state.key,
    };
  }

  if (obj instanceof MultiValueVariable || obj instanceof TextBoxVariable) {
    return {
      type: 'variable',
      name: obj.state.name,
      value: obj.getValue(),
      key: obj.state.key,
    };
  }

  return {
    type: 'unknown',
    key: obj.state.key,
    class: obj.constructor?.name,
  };
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
    const variables = vars
      .map((v) => ({ name: v.state.name, value: v.getValue() }))
      .sort((a, b) => collator.compare(a.name, b.name));

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

    const found =
      dashboard.state.body instanceof TabsLayoutManager
        ? dashboard.state.body
        : sceneGraph.findObject(dashboard, (o) => o instanceof TabsLayoutManager);
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

    const found =
      dashboard.state.body instanceof TabsLayoutManager
        ? dashboard.state.body
        : sceneGraph.findObject(dashboard, (o) => o instanceof TabsLayoutManager);
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

  getCurrentDashboardSelection: (space = 2) => {
    assertDashboardV2Enabled();
    const dashboard = getCurrentDashboardSceneOrThrow();
    const isEditing = Boolean(dashboard.state.isEditing);

    // Selection is only meaningful when editing; in view mode we keep this explicitly null.
    if (!isEditing) {
      return JSON.stringify({ isEditing, selection: null }, null, space);
    }

    const selection = dashboard.state.editPane.getSelection();
    if (!selection) {
      return JSON.stringify({ isEditing, selection: null }, null, space);
    }

    if (Array.isArray(selection)) {
      return JSON.stringify(
        {
          isEditing,
          selection: {
            mode: 'multi',
            items: selection.map((o) => toSelectedItem(o, dashboard)),
          },
        },
        null,
        space
      );
    }

    return JSON.stringify(
      {
        isEditing,
        selection: {
          mode: 'single',
          item: toSelectedItem(selection, dashboard),
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

    const rows = sceneGraph
      .findAllObjects(dashboard, (o) => o instanceof RowItem)
      .filter((o): o is RowItem => o instanceof RowItem);
    const row = rows.find(
      (r) => (rowKey ? r.state.key === rowKey : false) || (title ? r.state.title === title : false)
    );
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

  previewCurrentDashboardOps: (opsJson: string) => {
    assertDashboardV2Enabled();
    const parsed: unknown = JSON.parse(opsJson);
    let ops: unknown[] = [];
    if (Array.isArray(parsed)) {
      ops = parsed;
    } else if (isRecord(parsed)) {
      const v = parsed['ops'];
      if (Array.isArray(v)) {
        ops = v;
      }
    }

    if (!Array.isArray(ops)) {
      return JSON.stringify({ ok: false, errors: ['Invalid ops JSON: expected an array or { ops: [] }'] }, null, 2);
    }

    const errors: string[] = [];
    let supported = 0;
    let unsupported = 0;

    for (const op of ops) {
      if (!isRecord(op) || typeof op['op'] !== 'string') {
        errors.push('Invalid op: expected an object with "op" string');
        continue;
      }
      const opName = op['op'];
      if (
        opName === 'setPanelTitle' ||
        opName === 'setGridPos' ||
        opName === 'mergePanelConfig' ||
        opName === 'addPanel' ||
        opName === 'removePanel' ||
        opName === 'addRow' ||
        opName === 'removeRow' ||
        opName === 'addTab' ||
        opName === 'removeTab' ||
        opName === 'movePanelToRow' ||
        opName === 'movePanelToTab'
      ) {
        supported++;
      } else {
        unsupported++;
      }
    }

    // Best-effort: we do not validate existence here beyond parsing; apply will.
    return JSON.stringify(
      { ok: errors.length === 0, supported, unsupported, errors: errors.length ? errors : undefined },
      null,
      2
    );
  },

  applyCurrentDashboardOps: (opsJson: string) => {
    assertDashboardV2Enabled();
    const dashboard = getCurrentDashboardSceneOrThrow();
    if (!dashboard.state.isEditing) {
      dashboard.onEnterEditMode?.();
    }

    const parsed: unknown = JSON.parse(opsJson);
    let ops: unknown[] = [];
    if (Array.isArray(parsed)) {
      ops = parsed;
    } else if (isRecord(parsed)) {
      const v = parsed['ops'];
      if (Array.isArray(v)) {
        ops = v;
      }
    }

    if (!Array.isArray(ops)) {
      return JSON.stringify({ ok: false, errors: ['Invalid ops JSON: expected an array or { ops: [] }'] }, null, 2);
    }

    const errors: string[] = [];
    let applied = 0;
    const results: unknown[] = [];

    const getPanelsById = (panelId: number) => {
      // Note: dashboards can contain repeated panels (and some layouts can temporarily produce multiple
      // VizPanel instances for the same legacy id). To keep the live view and the serialized save model
      // consistent, apply config changes to all matching panels.
      return dashboardSceneGraph.getVizPanels(dashboard).filter((p) => getPanelIdForVizPanel(p) === panelId);
    };

    function getRootTabsManager(): TabsLayoutManager | null {
      const found =
        dashboard.state.body instanceof TabsLayoutManager
          ? dashboard.state.body
          : sceneGraph.findObject(dashboard, (o) => o instanceof TabsLayoutManager);
      return found instanceof TabsLayoutManager ? found : null;
    }

    function getCurrentLayoutManager() {
      const tabs = getRootTabsManager();
      if (tabs) {
        const currentTab = tabs.getCurrentTab();
        if (!currentTab) {
          throw new Error('Could not find currently active tab');
        }
        return currentTab.state.layout;
      }
      return dashboard.state.body;
    }

    function getCurrentRowsManagerOrThrow(): RowsLayoutManager {
      const layout = getCurrentLayoutManager();
      if (layout instanceof RowsLayoutManager) {
        return layout;
      }
      throw new Error('Current layout is not RowsLayout (addRow/removeRow require RowsLayout)');
    }

    for (const op of ops) {
      if (!isRecord(op) || typeof op['op'] !== 'string') {
        errors.push('Invalid op: expected an object with "op" string');
        continue;
      }

      const opName = op['op'];

      try {
        if (opName === 'addPanel') {
          const title = op['title'];
          const pluginId = op['pluginId'];
          const rowTitle = op['rowTitle'];
          const rowKey = op['rowKey'];

          if (title !== undefined && typeof title !== 'string') {
            throw new Error('addPanel: title must be a string when provided');
          }
          if (pluginId !== undefined && typeof pluginId !== 'string') {
            throw new Error('addPanel: pluginId must be a string when provided');
          }
          if (rowTitle !== undefined && typeof rowTitle !== 'string') {
            throw new Error('addPanel: rowTitle must be a string when provided');
          }
          if (rowKey !== undefined && typeof rowKey !== 'string') {
            throw new Error('addPanel: rowKey must be a string when provided');
          }

          const vizPanel: VizPanel = getDefaultVizPanel();
          if (typeof title === 'string') {
            vizPanel.setState({ title });
          }
          if (typeof pluginId === 'string') {
            vizPanel.setState({ pluginId });
          }

          const layout = getCurrentLayoutManager();

          // If we're in a RowsLayout, optionally target a specific row; otherwise use last row.
          if (layout instanceof RowsLayoutManager) {
            const rows = layout.state.rows;
            const row =
              rows.find(
                (r) => (rowKey ? r.state.key === rowKey : false) || (rowTitle ? r.state.title === rowTitle : false)
              ) ?? rows[rows.length - 1];
            if (!row) {
              throw new Error('addPanel: no row available to add to');
            }
            row.state.layout.addPanel(vizPanel);
          } else if ('addPanel' in layout && typeof layout.addPanel === 'function') {
            layout.addPanel(vizPanel);
          } else {
            throw new Error('addPanel: current layout does not support adding panels');
          }

          const newPanelId = getPanelIdForVizPanel(vizPanel);
          results.push({ op: 'addPanel', panelId: newPanelId, title: vizPanel.state.title });
          applied++;
          continue;
        }

        if (opName === 'removePanel') {
          const panelId = op['panelId'];
          if (typeof panelId !== 'number') {
            throw new Error('removePanel expects { panelId: number }');
          }

          const panels = getPanelsById(panelId);
          if (panels.length === 0) {
            throw new Error(`Panel not found: ${panelId}`);
          }

          for (const panel of panels) {
            dashboard.removePanel?.(panel);
          }

          results.push({ op: 'removePanel', panelId, removed: panels.length });
          applied++;
          continue;
        }

        if (opName === 'addRow') {
          const title = op['title'];
          if (title !== undefined && typeof title !== 'string') {
            throw new Error('addRow: title must be a string when provided');
          }

          // Mimic UI behavior: if the current tab is not a RowsLayout, migrate it to RowsLayout,
          // then add a new empty row (so existing panels remain in the first row).
          const tabsManager = getRootTabsManager();
          const currentTab = tabsManager?.getCurrentTab();
          const currentLayout = getCurrentLayoutManager();

          if (!(currentLayout instanceof RowsLayoutManager)) {
            addNewRowTo(currentLayout);
          }

          const nextLayout = currentTab ? currentTab.state.layout : dashboard.state.body;
          if (!(nextLayout instanceof RowsLayoutManager)) {
            throw new Error('Failed to switch to RowsLayout');
          }

          const existingTitles = new Set(
            nextLayout.state.rows
              .map((r) => r.state.title)
              .filter((t): t is string => typeof t === 'string' && t.length > 0)
          );
          const baseTitle = typeof title === 'string' && title.length ? title : 'New row';
          let nextTitle = baseTitle;
          if (existingTitles.has(nextTitle)) {
            let i = 2;
            while (existingTitles.has(`${baseTitle} ${i}`)) {
              i++;
            }
            nextTitle = `${baseTitle} ${i}`;
          }

          const row = new RowItem({ title: nextTitle });
          nextLayout.setState({ rows: [...nextLayout.state.rows, row] });

          results.push({ op: 'addRow', rowKey: row.state.key, title: row.state.title });
          applied++;
          continue;
        }

        if (opName === 'removeRow') {
          const title = op['title'];
          const rowKey = op['rowKey'];
          if (title !== undefined && typeof title !== 'string') {
            throw new Error('removeRow: title must be a string when provided');
          }
          if (rowKey !== undefined && typeof rowKey !== 'string') {
            throw new Error('removeRow: rowKey must be a string when provided');
          }

          const rowsManager = getCurrentRowsManagerOrThrow();
          const row = rowsManager.state.rows.find(
            (r) => (rowKey ? r.state.key === rowKey : false) || (title ? r.state.title === title : false)
          );
          if (!row) {
            throw new Error('Row not found');
          }
          rowsManager.removeRow(row, true);
          results.push({ op: 'removeRow', rowKey: row.state.key, title: row.state.title });
          applied++;
          continue;
        }

        if (opName === 'movePanelToRow') {
          const panelId = op['panelId'];
          const rowKey = op['rowKey'];
          const rowTitle = op['rowTitle'];

          if (typeof panelId !== 'number') {
            throw new Error('movePanelToRow expects { panelId: number, rowKey?: string, rowTitle?: string }');
          }
          if (rowKey !== undefined && typeof rowKey !== 'string') {
            throw new Error('movePanelToRow: rowKey must be a string when provided');
          }
          if (rowTitle !== undefined && typeof rowTitle !== 'string') {
            throw new Error('movePanelToRow: rowTitle must be a string when provided');
          }

          const rowsManager = getCurrentRowsManagerOrThrow();
          const targetRow =
            rowsManager.state.rows.find(
              (r) => (rowKey ? r.state.key === rowKey : false) || (rowTitle ? r.state.title === rowTitle : false)
            ) ?? rowsManager.state.rows[rowsManager.state.rows.length - 1];

          if (!targetRow) {
            throw new Error('movePanelToRow: target row not found');
          }

          const targetLayout = targetRow.state.layout;
          if (!(targetLayout instanceof AutoGridLayoutManager || targetLayout instanceof DefaultGridLayoutManager)) {
            throw new Error(
              `movePanelToRow currently supports only AutoGrid and Grid row layouts (got ${targetLayout.constructor?.name ?? 'unknown'})`
            );
          }

          const panels = getPanelsById(panelId);
          if (panels.length === 0) {
            throw new Error(`Panel not found: ${panelId}`);
          }

          for (const p of panels) {
            const sourceGridItem = p.parent instanceof DashboardGridItem ? p.parent : undefined;
            removeVizPanelFromCurrentLayoutInPlace(p);
            p.clearParent();
            addVizPanelToLayoutInPlace(targetLayout, p, sourceGridItem);
          }

          results.push({
            op: 'movePanelToRow',
            panelId,
            rowKey: targetRow.state.key,
            rowTitle: targetRow.state.title,
            moved: panels.length,
          });
          applied++;
          continue;
        }

        if (opName === 'movePanelToTab') {
          const panelId = op['panelId'];
          const tabTitle = op['tabTitle'];
          const tabSlug = op['tabSlug'];

          if (typeof panelId !== 'number') {
            throw new Error('movePanelToTab expects { panelId: number, tabTitle?: string, tabSlug?: string }');
          }
          if (tabTitle !== undefined && typeof tabTitle !== 'string') {
            throw new Error('movePanelToTab: tabTitle must be a string when provided');
          }
          if (tabSlug !== undefined && typeof tabSlug !== 'string') {
            throw new Error('movePanelToTab: tabSlug must be a string when provided');
          }

          const tabsManager = getRootTabsManager();
          if (!tabsManager) {
            throw new Error('movePanelToTab requires TabsLayout');
          }

          const tab = tabsManager.state.tabs.find(
            (t) => (tabSlug ? t.getSlug() === tabSlug : false) || (tabTitle ? t.state.title === tabTitle : false)
          );
          if (!tab) {
            throw new Error('Tab not found');
          }

          const panels = getPanelsById(panelId);
          if (panels.length === 0) {
            throw new Error(`Panel not found: ${panelId}`);
          }
          if (panels.length > 1) {
            throw new Error(
              'movePanelToTab does not support repeated panels (multiple instances share the same panelId)'
            );
          }

          const panel = panels[0];
          const sourceGridItem = panel.parent instanceof DashboardGridItem ? panel.parent : undefined;
          removeVizPanelFromCurrentLayoutInPlace(panel);
          panel.clearParent();
          const targetLayout = tab.getLayout();
          if (targetLayout instanceof RowsLayoutManager) {
            // Keep behavior aligned with RowsLayoutManager.addPanel (adds to first row), but support both grid types.
            const firstRow = targetLayout.state.rows[0];
            if (!firstRow) {
              throw new Error('movePanelToTab: target tab has no rows');
            }
            addVizPanelToLayoutInPlace(firstRow.state.layout, panel, sourceGridItem);
          } else {
            addVizPanelToLayoutInPlace(targetLayout, panel, sourceGridItem);
          }

          results.push({ op: 'movePanelToTab', panelId, tabTitle: tab.state.title, tabSlug: tab.getSlug() });
          applied++;
          continue;
        }

        if (opName === 'addTab') {
          const title = op['title'];
          if (title !== undefined && typeof title !== 'string') {
            throw new Error('addTab: title must be a string when provided');
          }

          const tabsManager = getRootTabsManager();
          if (!tabsManager) {
            throw new Error('addTab/removeTab require TabsLayout');
          }

          // Important: tab slug is derived from title. Set title before adding so currentTabSlug points at the final slug.
          const newTab = typeof title === 'string' && title.length ? new TabItem({ title }) : new TabItem({});
          const tab = tabsManager.addNewTab(newTab);
          // Defensive: make sure we end up on the final slug (slug can change if title is later edited / uniquified).
          tabsManager.switchToTab(tab);
          // keep URL in sync with the new tab selection
          locationService.partial({ [tabsManager.getUrlKey()]: tab.getSlug() }, true);

          results.push({ op: 'addTab', slug: tab.getSlug(), title: tab.state.title });
          applied++;
          continue;
        }

        if (opName === 'removeTab') {
          const title = op['title'];
          const slug = op['slug'];
          if (title !== undefined && typeof title !== 'string') {
            throw new Error('removeTab: title must be a string when provided');
          }
          if (slug !== undefined && typeof slug !== 'string') {
            throw new Error('removeTab: slug must be a string when provided');
          }

          const tabsManager = getRootTabsManager();
          if (!tabsManager) {
            throw new Error('addTab/removeTab require TabsLayout');
          }

          const tab = tabsManager
            .getTabsIncludingRepeats()
            .find((t) => (slug ? t.getSlug() === slug : false) || (title ? t.state.title === title : false));
          if (!tab) {
            throw new Error('Tab not found');
          }

          tabsManager.removeTab(tab, true);
          // keep URL in sync with the new current tab
          const current = tabsManager.getCurrentTab();
          if (current) {
            locationService.partial({ [tabsManager.getUrlKey()]: current.getSlug() }, true);
          }

          results.push({ op: 'removeTab', slug: tab.getSlug(), title: tab.state.title });
          applied++;
          continue;
        }

        if (opName === 'setPanelTitle') {
          const panelId = op['panelId'];
          const title = op['title'];
          if (typeof panelId !== 'number' || typeof title !== 'string') {
            throw new Error('setPanelTitle expects { panelId: number, title: string }');
          }
          const panels = getPanelsById(panelId);
          if (panels.length === 0) {
            throw new Error(`Panel not found: ${panelId}`);
          }
          for (const panel of panels) {
            panel.onTitleChange?.(title);
          }
          applied++;
          continue;
        }

        if (opName === 'setGridPos') {
          const panelIdRaw = op['panelId'];
          const xRaw = op['x'];
          const yRaw = op['y'];
          const wRaw = op['w'];
          const hRaw = op['h'];
          if (
            typeof panelIdRaw !== 'number' ||
            typeof xRaw !== 'number' ||
            typeof yRaw !== 'number' ||
            typeof wRaw !== 'number' ||
            typeof hRaw !== 'number'
          ) {
            throw new Error('setGridPos expects { panelId: number, x: number, y: number, w: number, h: number }');
          }
          const panelId = panelIdRaw;
          const x = xRaw;
          const y = yRaw;
          const w = wRaw;
          const h = hRaw;

          const panels = getPanelsById(panelId);
          const panel = panels[0];
          if (!panel) {
            throw new Error(`Panel not found: ${panelId}`);
          }
          const gridItem = findParent(panel, (o): o is DashboardGridItem => o instanceof DashboardGridItem);
          if (!gridItem) {
            // AutoGrid does not support explicit positions; require full apply for now.
            throw new Error('setGridPos is only supported for GridLayout panels');
          }
          gridItem.setState({ x, y, width: w, height: h });
          applied++;
          continue;
        }

        if (opName === 'setPanelRepeat') {
          const panelId = op['panelId'];
          const variableName = op['variableName'];
          const repeatDirection = op['direction'];
          const maxPerRow = op['maxPerRow'];

          if (typeof panelId !== 'number') {
            throw new Error(
              'setPanelRepeat expects { panelId: number, variableName?: string, direction?: "h" | "v", maxPerRow?: number }'
            );
          }
          if (variableName !== undefined && typeof variableName !== 'string') {
            throw new Error('setPanelRepeat: variableName must be a string when provided');
          }
          if (repeatDirection !== undefined && repeatDirection !== 'h' && repeatDirection !== 'v') {
            throw new Error('setPanelRepeat: direction must be "h" or "v" when provided');
          }
          if (maxPerRow !== undefined && typeof maxPerRow !== 'number') {
            throw new Error('setPanelRepeat: maxPerRow must be a number when provided');
          }

          const panels = getPanelsById(panelId);
          if (panels.length === 0) {
            throw new Error(`Panel not found: ${panelId}`);
          }
          if (panels.length > 1) {
            throw new Error(
              'setPanelRepeat does not support repeated panels (multiple instances share the same panelId)'
            );
          }

          const panel = panels[0];
          const gridItem = findParent(panel, (o): o is DashboardGridItem => o instanceof DashboardGridItem);
          if (!gridItem) {
            throw new Error('setPanelRepeat: panel is not in a grid layout');
          }

          const nextState: Partial<DashboardGridItem['state']> = {};
          if (variableName !== undefined) {
            nextState.variableName = variableName;
          }
          if (repeatDirection !== undefined) {
            nextState.repeatDirection = repeatDirection;
          }
          if (maxPerRow !== undefined) {
            nextState.maxPerRow = maxPerRow;
          }

          gridItem.setState(nextState);
          applied++;
          continue;
        }

        if (opName === 'mergePanelConfig') {
          const panelId = op['panelId'];
          const mergeObj = op['merge'];
          if (typeof panelId !== 'number' || !isRecord(mergeObj)) {
            throw new Error('mergePanelConfig expects { panelId: number, merge: object }');
          }
          const panels = getPanelsById(panelId);
          if (panels.length === 0) {
            throw new Error(`Panel not found: ${panelId}`);
          }

          // Accept either { vizConfig: { fieldConfig?, options?, group? } } or { fieldConfig?, options?, pluginId? }.
          const vizConfigAny = mergeObj['vizConfig'];
          const vizConfig = isRecord(vizConfigAny) ? vizConfigAny : undefined;
          const fieldConfigAny = (vizConfig && vizConfig['fieldConfig']) ?? mergeObj['fieldConfig'];
          const optionsAny = (vizConfig && vizConfig['options']) ?? mergeObj['options'];
          const pluginIdValue = mergeObj['pluginId'];
          const pluginIdFromMerge = typeof pluginIdValue === 'string' ? pluginIdValue : undefined;
          const pluginFromVizGroupValue = vizConfig?.['group'];
          const pluginFromVizGroup = typeof pluginFromVizGroupValue === 'string' ? pluginFromVizGroupValue : undefined;
          const nextPluginId = pluginIdFromMerge ?? pluginFromVizGroup;

          for (const panel of panels) {
            const pluginChanged = nextPluginId && panel.state.pluginId !== nextPluginId;

            // Field config: support defaults merge (units, decimals, thresholds, mappings, etc).
            if (isRecord(fieldConfigAny)) {
              const defaultsAny = fieldConfigAny['defaults'];
              if (isRecord(defaultsAny)) {
                const prevDefaults = panel.state.fieldConfig?.defaults ?? {};
                const prevOverrides = panel.state.fieldConfig?.overrides ?? [];
                const nextDefaults = { ...prevDefaults, ...defaultsAny };
                const nextFieldConfig = { defaults: nextDefaults, overrides: prevOverrides };
                // Prefer `onFieldConfigChange` so the panel clears its internal field-config cache and
                // applies plugin defaults consistently (needed for correct rendering, e.g. stat thresholds).
                try {
                  panel.onFieldConfigChange?.(nextFieldConfig, true);
                } catch {
                  // Fallback to a plain state update if plugin defaults application fails.
                  panel.setState({ fieldConfig: nextFieldConfig });
                }
              }
            }

            // Options: allow passing arbitrary plugin options object (DeepPartial<{}> is permissive).
            if (isRecord(optionsAny)) {
              panel.onOptionsChange?.(optionsAny, false);
            }

            // Plugin change: allow switching visualization (e.g. stat -> timeseries) in place.
            if (pluginChanged) {
              // Fire-and-forget; changePluginType is async and handles plugin defaults/migration.
              const nextFieldConfig = isRecord(fieldConfigAny)
                ? {
                    defaults: isRecord(fieldConfigAny['defaults']) ? fieldConfigAny['defaults'] : {},
                    overrides: Array.isArray(fieldConfigAny['overrides']) ? fieldConfigAny['overrides'] : [],
                  }
                : undefined;
              void panel.changePluginType(nextPluginId, isRecord(optionsAny) ? optionsAny : undefined, nextFieldConfig);
            }

            // If merge included unknown keys, attempt a safe best-effort by merging state keys we recognize.
            // (This intentionally stays conservative; prefer fieldConfig/options.)
            const title = mergeObj['title'];
            if (typeof title === 'string') {
              panel.onTitleChange?.(title);
            }
          }

          applied++;
          continue;
        }

        if (opName === 'setPanelState') {
          const panelId = op['panelId'];
          if (typeof panelId !== 'number') {
            throw new Error('setPanelState expects { panelId: number, ... }');
          }
          const panels = getPanelsById(panelId);
          if (panels.length === 0) {
            throw new Error(`Panel not found: ${panelId}`);
          }

          for (const panel of panels) {
            const description = op['description'];
            if (typeof description === 'string') {
              panel.setState({ description });
            }

            const transparent = op['transparent'];
            if (typeof transparent === 'boolean') {
              panel.setState({ displayMode: transparent ? 'transparent' : undefined });
            }

            const linksValue = op['links'];
            if (Array.isArray(linksValue)) {
              const panelLinks = dashboardSceneGraph.getPanelLinks(panel);
              if (panelLinks) {
                const safeLinks = linksValue.filter(
                  (link): link is DataLink => typeof link === 'object' && link !== null
                );
                panelLinks.setState({ rawLinks: safeLinks });
              }
            }
          }

          applied++;
          continue;
        }

        if (opName === 'setPanelData') {
          const panelId = op['panelId'];
          const dataSpec = op['data'];
          if (typeof panelId !== 'number' || !isRecord(dataSpec)) {
            throw new Error('setPanelData expects { panelId: number, data: object }');
          }
          const panels = getPanelsById(panelId);
          if (panels.length === 0) {
            throw new Error(`Panel not found: ${panelId}`);
          }

          for (const panel of panels) {
            const queryRunner = getQueryRunnerFor(panel);

            const queriesValue = dataSpec['queries'];
            if (Array.isArray(queriesValue) && queryRunner instanceof SceneQueryRunner) {
              const toSceneQuery = (raw: unknown): SceneDataQuery | undefined => {
                // Support both SceneDataQuery shape and PanelQueryKind shape.
                if (isRecord(raw) && isRecord(raw['spec']) && isRecord(raw['spec']['query'])) {
                  const spec = raw['spec'];
                  const refId = typeof spec['refId'] === 'string' ? spec['refId'] : 'A';
                  const hidden = typeof spec['hidden'] === 'boolean' ? spec['hidden'] : undefined;
                  const innerQuery = spec['query'];
                  if (!isRecord(innerQuery)) {
                    return undefined;
                  }
                  const querySpec = isRecord(innerQuery['spec']) ? innerQuery['spec'] : undefined;
                  const dsValue = isRecord(innerQuery['datasource']) ? innerQuery['datasource'] : undefined;
                  const groupValue = typeof innerQuery['group'] === 'string' ? innerQuery['group'] : undefined;
                  const uid = dsValue && typeof dsValue['uid'] === 'string' ? dsValue['uid'] : undefined;
                  const name = dsValue && typeof dsValue['name'] === 'string' ? dsValue['name'] : undefined;
                  const datasource =
                    uid || name
                      ? {
                          uid: uid ?? name!,
                          ...(groupValue ? { type: groupValue } : {}),
                        }
                      : groupValue
                        ? { type: groupValue }
                        : undefined;

                  const result: SceneDataQuery = { refId };
                  if (typeof hidden === 'boolean') {
                    result.hide = hidden;
                  }
                  if (datasource) {
                    result.datasource = datasource;
                  }
                  if (querySpec) {
                    Object.assign(result, querySpec);
                  }
                  return result;
                }

                // Already a SceneDataQuery shape; accept as-is.
                if (isRecord(raw)) {
                  const refId = typeof raw['refId'] === 'string' ? raw['refId'] : 'A';
                  const result: SceneDataQuery = { refId };
                  Object.assign(result, raw);
                  return result;
                }
                return undefined;
              };

              const normalizedQueries: SceneDataQuery[] = queriesValue
                .map((q) => toSceneQuery(q))
                .filter((q): q is SceneDataQuery => Boolean(q));

              queryRunner.setState({ queries: normalizedQueries });
              // Immediately rerun queries to reflect changes in the UI.
              queryRunner.runQueries?.();
            }

            const queryOptions = dataSpec['queryOptions'];
            if (isRecord(queryOptions) && queryRunner instanceof SceneQueryRunner) {
              const nextQueryRunnerState: Record<string, unknown> = {};
              const maxDataPoints = queryOptions['maxDataPoints'];
              if (typeof maxDataPoints === 'number') {
                nextQueryRunnerState.maxDataPoints = maxDataPoints;
              }
              const cacheTimeout = queryOptions['cacheTimeout'];
              if (typeof cacheTimeout === 'number') {
                nextQueryRunnerState.cacheTimeout = cacheTimeout;
              }
              const queryCachingTTL = queryOptions['queryCachingTTL'];
              if (typeof queryCachingTTL === 'number') {
                nextQueryRunnerState.queryCachingTTL = queryCachingTTL;
              }
              const interval = queryOptions['interval'];
              if (typeof interval === 'string' || typeof interval === 'number') {
                nextQueryRunnerState.minInterval = interval;
              }
              if (Object.keys(nextQueryRunnerState).length > 0) {
                queryRunner.setState(nextQueryRunnerState);
              }

              const timeFrom = queryOptions['timeFrom'];
              const timeShift = queryOptions['timeShift'];
              const hideTimeOverride = queryOptions['hideTimeOverride'];
              const compareWith = queryOptions['timeCompare'];
              if (
                typeof timeFrom === 'string' ||
                typeof timeShift === 'string' ||
                typeof hideTimeOverride === 'boolean' ||
                typeof compareWith === 'string'
              ) {
                const existingTimeRange = panel.state.$timeRange;
                const nextTimeRange =
                  existingTimeRange instanceof PanelTimeRange
                    ? existingTimeRange
                    : new PanelTimeRange({ enabled: true });
                const nextState: Record<string, unknown> = { enabled: true };
                if (typeof timeFrom === 'string') {
                  nextState.timeFrom = timeFrom;
                }
                if (typeof timeShift === 'string') {
                  nextState.timeShift = timeShift;
                }
                if (typeof hideTimeOverride === 'boolean') {
                  nextState.hideTimeOverride = hideTimeOverride;
                }
                if (typeof compareWith === 'string') {
                  nextState.compareWith = compareWith;
                }
                nextTimeRange.setState(nextState);
                panel.setState({ $timeRange: nextTimeRange });
              }
            }

            const transformationsValue = dataSpec['transformations'];
            if (Array.isArray(transformationsValue) && panel.state.$data instanceof SceneDataTransformer) {
              panel.state.$data.setState({ transformations: transformationsValue });
            }
          }

          applied++;
          continue;
        }

        errors.push(`Unsupported op: ${opName}`);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        errors.push(`${String(opName)}: ${msg}`);
      }
    }

    // Mark dirty explicitly if currently editing and we applied changes. This helps keep Save enabled even if
    // we applied changes before the change tracker picks them up.
    if (applied > 0 && dashboard.state.isEditing) {
      dashboard.setState({ isDirty: true });
    }

    return JSON.stringify(
      {
        ok: errors.length === 0,
        applied,
        results: results.length ? results : undefined,
        errors: errors.length ? errors : undefined,
      },
      null,
      2
    );
  },
};
