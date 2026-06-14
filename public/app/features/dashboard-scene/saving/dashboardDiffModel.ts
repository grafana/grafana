import { behaviors, sceneGraph, type SceneVariable, sceneUtils, type VizPanel } from '@grafana/scenes';
import { type Dashboard, type Panel, type VariableModel } from '@grafana/schema';
import {
  type Spec as DashboardV2Spec,
  type Element,
  type VariableKind,
} from '@grafana/schema/apis/dashboard.grafana.app/v2';
import { type DashboardWithAccessInfo } from 'app/features/dashboard/api/types';
import { isDashboardV2Spec } from 'app/features/dashboard/api/utils';
import { type DashboardDataDTO } from 'app/types/dashboard';

import { type DashboardScene } from '../scene/DashboardScene';
import { transformSaveModelSchemaV2ToScene } from '../serialization/transformSaveModelSchemaV2ToScene';
import { transformSaveModelToScene } from '../serialization/transformSaveModelToScene';
import { dashboardSceneGraph } from '../utils/dashboardSceneGraph';
import { findVizPanelByKey, getPanelIdForVizPanel, getVizPanelKeyForPanelId } from '../utils/utils';

export type ChangeType = 'changed' | 'added' | 'removed';

export interface PanelChangeRow {
  id: number;
  type: ChangeType;
  title: string;
  height: number;
  revert: () => void;
}

export interface FieldChange {
  label: string;
  type: ChangeType;
  oldText: string;
  newText: string;
  revert: () => void;
}

export interface VariableChangeRow {
  name: string;
  type: ChangeType;
  oldVariable?: SceneVariable;
  newVariable?: SceneVariable;
  revert: () => void;
}

export interface VisualDiffModel {
  oldScene: DashboardScene;
  newScene: DashboardScene;
  oldPanels: Map<number, VizPanel>;
  newPanels: Map<number, VizPanel>;
  panelRows: PanelChangeRow[];
  variableRows: VariableChangeRow[];
  optionChanges: FieldChange[];
}

const ROW_UNIT_HEIGHT = 30;
const DEFAULT_PANEL_GRID_HEIGHT = 8;
const DEFAULT_PANEL_HEIGHT = DEFAULT_PANEL_GRID_HEIGHT * ROW_UNIT_HEIGHT;

type SaveModel = Dashboard | DashboardV2Spec;

// Dashboard-level options we surface, keyed so the revert logic can map a change back to the right
// piece of scene state regardless of which schema produced it.
type OptionKey = 'title' | 'description' | 'tags' | 'editable' | 'timezone' | 'weekStart' | 'refresh' | 'tooltip';

interface RawPanelRow {
  id: number;
  type: ChangeType;
  title: string;
  height: number;
}

interface RawFieldChange {
  label: string;
  type: ChangeType;
  oldText: string;
  newText: string;
}

interface RawOptionChange extends RawFieldChange {
  key: OptionKey;
}

/**
 * Builds the data backing the visual diff: a throwaway scene per version (so panels render with live
 * data) plus the structured lists of panel/variable/option changes. Each change carries a `revert`
 * callback that mutates the live dashboard so the change is excluded on save, by copying the value
 * from the old-version scene. The scene rendering and revert core are schema agnostic; only the
 * change enumeration branches on the v1/v2 schema shape.
 */
export function buildVisualDiff(dashboard: DashboardScene, oldValue: SaveModel, newValue: SaveModel): VisualDiffModel {
  const { from, to, timeZone } = readCurrentTimeRange(dashboard);

  const oldScene = buildScene(oldValue, from, to, timeZone);
  const newScene = buildScene(newValue, from, to, timeZone);

  const oldPanels = mapScenePanelsById(oldScene);
  const newPanels = mapScenePanelsById(newScene);

  let rawPanelRows: RawPanelRow[] = [];
  let rawVariableChanges: RawFieldChange[] = [];
  let rawOptionChanges: RawOptionChange[] = [];

  if (isDashboardV2Spec(oldValue) && isDashboardV2Spec(newValue)) {
    rawPanelRows = computeV2PanelRows(oldValue, newValue);
    rawVariableChanges = computeV2VariableChanges(oldValue, newValue);
    rawOptionChanges = computeV2OptionChanges(oldValue, newValue);
  } else if (!isDashboardV2Spec(oldValue) && !isDashboardV2Spec(newValue)) {
    rawPanelRows = computeV1PanelRows(oldValue, newValue);
    rawVariableChanges = computeV1VariableChanges(oldValue, newValue);
    rawOptionChanges = computeV1OptionChanges(oldValue, newValue);
  }
  // The two versions are always the same schema (the change calculation converts both to a common
  // form), so a mixed pair leaves the lists empty rather than guessing.

  const panelRows: PanelChangeRow[] = rawPanelRows.map((row) => ({
    ...row,
    revert: () => revertPanel(dashboard, oldScene, row),
  }));

  const oldVariables = mapSceneVariablesByName(oldScene);
  const newVariables = mapSceneVariablesByName(newScene);
  const variableRows: VariableChangeRow[] = rawVariableChanges.map((change) => ({
    name: change.label,
    type: change.type,
    oldVariable: oldVariables.get(change.label),
    newVariable: newVariables.get(change.label),
    revert: () => revertVariable(dashboard, oldScene, change.label),
  }));

  const optionChanges: FieldChange[] = rawOptionChanges.map(({ key, ...change }) => ({
    ...change,
    revert: () => revertOption(dashboard, oldScene, key),
  }));

  return { oldScene, newScene, oldPanels, newPanels, panelRows, variableRows, optionChanges };
}

function mapSceneVariablesByName(scene: DashboardScene): Map<string, SceneVariable> {
  const map = new Map<string, SceneVariable>();
  for (const variable of scene.state.$variables?.state.variables ?? []) {
    map.set(variable.state.name, variable);
  }
  return map;
}

function readCurrentTimeRange(dashboard: DashboardScene) {
  const timeRange = sceneGraph.getTimeRange(dashboard);
  return {
    from: timeRange.state.from,
    to: timeRange.state.to,
    timeZone: timeRange.state.timeZone,
  };
}

function buildScene(model: SaveModel, from: string, to: string, timeZone?: string): DashboardScene {
  const scene = isDashboardV2Spec(model) ? buildV2Scene(model) : buildV1Scene(model);

  // Force both versions onto the dashboard's current time range/zone so differences reflect config
  // changes rather than a different time window.
  scene.state.$timeRange?.setState({ from, to, timeZone });

  return scene;
}

function buildV1Scene(model: Dashboard): DashboardScene {
  // Dashboard's title/uid are optional but DashboardDataDTO requires them; fill with safe defaults
  // rather than asserting the type.
  const dashboard: DashboardDataDTO = { ...model, title: model.title ?? '', uid: model.uid ?? '' };
  return transformSaveModelToScene({ dashboard, meta: { isEmbedded: true } });
}

function buildV2Scene(spec: DashboardV2Spec): DashboardScene {
  const dto: DashboardWithAccessInfo<DashboardV2Spec> = {
    kind: 'DashboardWithAccessInfo',
    apiVersion: 'v2',
    metadata: { name: '', resourceVersion: '', creationTimestamp: '' },
    spec,
    access: {},
  };
  return transformSaveModelSchemaV2ToScene(dto);
}

function mapScenePanelsById(scene: DashboardScene): Map<number, VizPanel> {
  const map = new Map<number, VizPanel>();
  for (const panel of scene.state.body.getVizPanels()) {
    map.set(getPanelIdForVizPanel(panel), panel);
  }
  return map;
}

// --- revert (mutates the live dashboard by copying from the old-version scene) ---

function revertPanel(dashboard: DashboardScene, oldScene: DashboardScene, row: RawPanelRow): void {
  const key = getVizPanelKeyForPanelId(row.id);
  const livePanel = findVizPanelByKey(dashboard, key);
  const oldPanel = findVizPanelByKey(oldScene, key);

  if (row.type === 'added') {
    if (livePanel) {
      dashboard.removePanel(livePanel);
    }
    return;
  }

  if (row.type === 'removed') {
    if (oldPanel) {
      dashboard.addPanel(oldPanel.clone());
    }
    return;
  }

  // changed: replace the live panel's state with the old version (re-runs its queries).
  if (livePanel && oldPanel) {
    livePanel.setState(sceneUtils.cloneSceneObjectState(oldPanel.state, { key: livePanel.state.key }));
  }
}

function revertVariable(dashboard: DashboardScene, oldScene: DashboardScene, name: string): void {
  const liveSet = dashboard.state.$variables;
  if (!liveSet) {
    return;
  }

  const current = liveSet.state.variables;
  const oldVariable = oldScene.state.$variables?.state.variables.find((variable) => variable.state.name === name);
  const existsLive = current.some((variable) => variable.state.name === name);

  let next = current;
  if (oldVariable && existsLive) {
    next = current.map((variable) => (variable.state.name === name ? oldVariable.clone() : variable));
  } else if (oldVariable) {
    next = [...current, oldVariable.clone()];
  } else {
    next = current.filter((variable) => variable.state.name !== name);
  }

  liveSet.setState({ variables: next });
}

function revertOption(dashboard: DashboardScene, oldScene: DashboardScene, key: OptionKey): void {
  switch (key) {
    case 'title':
      dashboard.setState({ title: oldScene.state.title });
      return;
    case 'description':
      dashboard.setState({ description: oldScene.state.description });
      return;
    case 'tags':
      dashboard.setState({ tags: oldScene.state.tags });
      return;
    case 'editable':
      dashboard.setState({ editable: oldScene.state.editable });
      return;
    case 'timezone':
      sceneGraph.getTimeRange(dashboard).setState({ timeZone: sceneGraph.getTimeRange(oldScene).state.timeZone });
      return;
    case 'weekStart':
      sceneGraph.getTimeRange(dashboard).setState({ weekStart: sceneGraph.getTimeRange(oldScene).state.weekStart });
      return;
    case 'refresh': {
      const oldPicker = dashboardSceneGraph.getRefreshPicker(oldScene);
      const livePicker = dashboardSceneGraph.getRefreshPicker(dashboard);
      if (oldPicker && livePicker) {
        livePicker.setState({ refresh: oldPicker.state.refresh });
      }
      return;
    }
    case 'tooltip': {
      const oldSync = findCursorSync(oldScene);
      const liveSync = findCursorSync(dashboard);
      if (oldSync && liveSync) {
        liveSync.setState({ sync: oldSync.state.sync });
      }
      return;
    }
  }
}

function findCursorSync(scene: DashboardScene): behaviors.CursorSync | undefined {
  return scene.state.$behaviors?.find((behavior): behavior is behaviors.CursorSync => {
    return behavior instanceof behaviors.CursorSync;
  });
}

// --- v1 (legacy Dashboard schema) adapters ---

const V1_OPTION_FIELDS: Array<{ key: OptionKey; label: string; get: (model: Dashboard) => unknown }> = [
  { key: 'title', label: 'Title', get: (model) => model.title },
  { key: 'description', label: 'Description', get: (model) => model.description },
  { key: 'tags', label: 'Tags', get: (model) => model.tags },
  { key: 'timezone', label: 'Timezone', get: (model) => model.timezone },
  { key: 'refresh', label: 'Auto refresh', get: (model) => model.refresh },
  { key: 'editable', label: 'Editable', get: (model) => model.editable },
  { key: 'tooltip', label: 'Panel tooltip', get: (model) => model.graphTooltip },
  { key: 'weekStart', label: 'Week start', get: (model) => model.weekStart },
];

function computeV1PanelRows(oldValue: Dashboard, newValue: Dashboard): RawPanelRow[] {
  return diffById(mapV1PanelsById(oldValue), mapV1PanelsById(newValue), {
    title: (panel) => panel.title ?? '',
    height: (panel) => (panel.gridPos?.h ?? DEFAULT_PANEL_GRID_HEIGHT) * ROW_UNIT_HEIGHT,
  });
}

function mapV1PanelsById(model: Dashboard): Map<number, Panel> {
  const map = new Map<number, Panel>();
  for (const panel of model.panels ?? []) {
    if (panel.type === 'row' || panel.id === undefined) {
      continue;
    }
    map.set(panel.id, panel);
  }
  return map;
}

function computeV1VariableChanges(oldValue: Dashboard, newValue: Dashboard): RawFieldChange[] {
  return diffByName(mapV1VariablesByName(oldValue), mapV1VariablesByName(newValue));
}

function mapV1VariablesByName(model: Dashboard): Map<string, VariableModel> {
  const map = new Map<string, VariableModel>();
  for (const variable of model.templating?.list ?? []) {
    map.set(variable.name, variable);
  }
  return map;
}

function computeV1OptionChanges(oldValue: Dashboard, newValue: Dashboard): RawOptionChange[] {
  return diffFields(
    V1_OPTION_FIELDS.map(({ key, label, get }) => ({ key, label, get: (model: Dashboard) => get(model) })),
    oldValue,
    newValue
  );
}

// --- v2 (DashboardV2Spec) adapters ---

const V2_OPTION_FIELDS: Array<{ key: OptionKey; label: string; get: (spec: DashboardV2Spec) => unknown }> = [
  { key: 'title', label: 'Title', get: (spec) => spec.title },
  { key: 'description', label: 'Description', get: (spec) => spec.description },
  { key: 'tags', label: 'Tags', get: (spec) => spec.tags },
  { key: 'editable', label: 'Editable', get: (spec) => spec.editable },
  { key: 'tooltip', label: 'Panel tooltip', get: (spec) => spec.cursorSync },
  { key: 'timezone', label: 'Timezone', get: (spec) => spec.timeSettings.timezone },
  { key: 'refresh', label: 'Auto refresh', get: (spec) => spec.timeSettings.autoRefresh },
  { key: 'weekStart', label: 'Week start', get: (spec) => spec.timeSettings.weekStart },
];

function computeV2PanelRows(oldValue: DashboardV2Spec, newValue: DashboardV2Spec): RawPanelRow[] {
  return diffById(mapV2ElementsById(oldValue), mapV2ElementsById(newValue), {
    title: (element) => element.spec.title,
    height: () => DEFAULT_PANEL_HEIGHT,
  });
}

function mapV2ElementsById(spec: DashboardV2Spec): Map<number, Element> {
  const map = new Map<number, Element>();
  for (const key of Object.keys(spec.elements)) {
    const element = spec.elements[key];
    map.set(element.spec.id, element);
  }
  return map;
}

function computeV2VariableChanges(oldValue: DashboardV2Spec, newValue: DashboardV2Spec): RawFieldChange[] {
  return diffByName(mapV2VariablesByName(oldValue), mapV2VariablesByName(newValue));
}

function mapV2VariablesByName(spec: DashboardV2Spec): Map<string, VariableKind> {
  const map = new Map<string, VariableKind>();
  for (const variable of spec.variables) {
    map.set(variable.spec.name, variable);
  }
  return map;
}

function computeV2OptionChanges(oldValue: DashboardV2Spec, newValue: DashboardV2Spec): RawOptionChange[] {
  return diffFields(V2_OPTION_FIELDS, oldValue, newValue);
}

// --- shared diff helpers ---

interface PanelAccessors<T> {
  title: (item: T) => string;
  height: (item: T) => number;
}

function diffById<T>(oldItems: Map<number, T>, newItems: Map<number, T>, accessors: PanelAccessors<T>): RawPanelRow[] {
  const rows: RawPanelRow[] = [];
  const ids = new Set([...oldItems.keys(), ...newItems.keys()]);

  for (const id of ids) {
    const oldItem = oldItems.get(id);
    const newItem = newItems.get(id);

    if (oldItem && newItem) {
      if (JSON.stringify(oldItem) !== JSON.stringify(newItem)) {
        rows.push({ id, type: 'changed', title: accessors.title(newItem), height: accessors.height(newItem) });
      }
    } else if (newItem) {
      rows.push({ id, type: 'added', title: accessors.title(newItem), height: accessors.height(newItem) });
    } else if (oldItem) {
      rows.push({ id, type: 'removed', title: accessors.title(oldItem), height: accessors.height(oldItem) });
    }
  }

  return rows;
}

function diffByName<T>(oldItems: Map<string, T>, newItems: Map<string, T>): RawFieldChange[] {
  const changes: RawFieldChange[] = [];
  const names = new Set([...oldItems.keys(), ...newItems.keys()]);

  for (const name of names) {
    const oldItem = oldItems.get(name);
    const newItem = newItems.get(name);
    const oldText = oldItem === undefined ? '' : formatValue(oldItem);
    const newText = newItem === undefined ? '' : formatValue(newItem);

    if (oldItem !== undefined && newItem !== undefined) {
      if (oldText !== newText) {
        changes.push({ label: name, type: 'changed', oldText, newText });
      }
    } else if (newItem !== undefined) {
      changes.push({ label: name, type: 'added', oldText, newText });
    } else if (oldItem !== undefined) {
      changes.push({ label: name, type: 'removed', oldText, newText });
    }
  }

  return changes;
}

function diffFields<T>(
  fields: Array<{ key: OptionKey; label: string; get: (model: T) => unknown }>,
  oldValue: T,
  newValue: T
): RawOptionChange[] {
  const changes: RawOptionChange[] = [];

  for (const { key, label, get } of fields) {
    const oldText = formatValue(get(oldValue));
    const newText = formatValue(get(newValue));
    if (oldText !== newText) {
      changes.push({ key, label, type: 'changed', oldText, newText });
    }
  }

  return changes;
}

export function formatValue(value: unknown): string {
  if (value === undefined || value === null) {
    return '';
  }
  if (typeof value === 'string') {
    return value;
  }
  return JSON.stringify(value, null, 2);
}
