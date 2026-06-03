import { sceneGraph, type VizPanel } from '@grafana/scenes';
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
import { getPanelIdForVizPanel } from '../utils/utils';

export type ChangeType = 'changed' | 'added' | 'removed';

export interface PanelChangeRow {
  id: number;
  type: ChangeType;
  title: string;
  height: number;
}

export interface FieldChange {
  label: string;
  type: ChangeType;
  oldText: string;
  newText: string;
}

export interface VisualDiffModel {
  oldScene: DashboardScene;
  newScene: DashboardScene;
  oldPanels: Map<number, VizPanel>;
  newPanels: Map<number, VizPanel>;
  panelRows: PanelChangeRow[];
  variableChanges: FieldChange[];
  optionChanges: FieldChange[];
}

const ROW_UNIT_HEIGHT = 30;
const DEFAULT_PANEL_GRID_HEIGHT = 8;
const DEFAULT_PANEL_HEIGHT = DEFAULT_PANEL_GRID_HEIGHT * ROW_UNIT_HEIGHT;

type SaveModel = Dashboard | DashboardV2Spec;

/**
 * Builds the data backing the visual diff: a throwaway scene per version (so panels render with live
 * data) plus the structured lists of panel/variable/option changes. The scene rendering core is
 * schema agnostic; only the change enumeration branches on the v1/v2 schema shape.
 */
export function buildVisualDiff(dashboard: DashboardScene, oldValue: SaveModel, newValue: SaveModel): VisualDiffModel {
  const { from, to, timeZone } = readCurrentTimeRange(dashboard);

  const oldScene = buildScene(oldValue, from, to, timeZone);
  const newScene = buildScene(newValue, from, to, timeZone);

  const oldPanels = mapScenePanelsById(oldScene);
  const newPanels = mapScenePanelsById(newScene);

  let panelRows: PanelChangeRow[] = [];
  let variableChanges: FieldChange[] = [];
  let optionChanges: FieldChange[] = [];

  if (isDashboardV2Spec(oldValue) && isDashboardV2Spec(newValue)) {
    panelRows = computeV2PanelRows(oldValue, newValue);
    variableChanges = computeV2VariableChanges(oldValue, newValue);
    optionChanges = computeV2OptionChanges(oldValue, newValue);
  } else if (!isDashboardV2Spec(oldValue) && !isDashboardV2Spec(newValue)) {
    panelRows = computeV1PanelRows(oldValue, newValue);
    variableChanges = computeV1VariableChanges(oldValue, newValue);
    optionChanges = computeV1OptionChanges(oldValue, newValue);
  }
  // The two versions are always the same schema (the change calculation converts both to a common
  // form), so a mixed pair leaves the lists empty rather than guessing.

  return { oldScene, newScene, oldPanels, newPanels, panelRows, variableChanges, optionChanges };
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

// --- v1 (legacy Dashboard schema) adapters ---

const V1_OPTION_FIELDS: Array<{ key: keyof Dashboard; label: string }> = [
  { key: 'title', label: 'Title' },
  { key: 'description', label: 'Description' },
  { key: 'tags', label: 'Tags' },
  { key: 'timezone', label: 'Timezone' },
  { key: 'refresh', label: 'Auto refresh' },
  { key: 'editable', label: 'Editable' },
  { key: 'graphTooltip', label: 'Panel tooltip' },
  { key: 'weekStart', label: 'Week start' },
];

function computeV1PanelRows(oldValue: Dashboard, newValue: Dashboard): PanelChangeRow[] {
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

function computeV1VariableChanges(oldValue: Dashboard, newValue: Dashboard): FieldChange[] {
  return diffByName(mapV1VariablesByName(oldValue), mapV1VariablesByName(newValue));
}

function mapV1VariablesByName(model: Dashboard): Map<string, VariableModel> {
  const map = new Map<string, VariableModel>();
  for (const variable of model.templating?.list ?? []) {
    map.set(variable.name, variable);
  }
  return map;
}

function computeV1OptionChanges(oldValue: Dashboard, newValue: Dashboard): FieldChange[] {
  return diffFields(
    V1_OPTION_FIELDS.map(({ key, label }) => ({ label, get: (model: Dashboard) => model[key] })),
    oldValue,
    newValue
  );
}

// --- v2 (DashboardV2Spec) adapters ---

const V2_OPTION_FIELDS: Array<{ label: string; get: (spec: DashboardV2Spec) => unknown }> = [
  { label: 'Title', get: (spec) => spec.title },
  { label: 'Description', get: (spec) => spec.description },
  { label: 'Tags', get: (spec) => spec.tags },
  { label: 'Editable', get: (spec) => spec.editable },
  { label: 'Panel tooltip', get: (spec) => spec.cursorSync },
  { label: 'Timezone', get: (spec) => spec.timeSettings.timezone },
  { label: 'Auto refresh', get: (spec) => spec.timeSettings.autoRefresh },
  { label: 'Time from', get: (spec) => spec.timeSettings.from },
  { label: 'Time to', get: (spec) => spec.timeSettings.to },
  { label: 'Week start', get: (spec) => spec.timeSettings.weekStart },
  { label: 'Hide time picker', get: (spec) => spec.timeSettings.hideTimepicker },
];

function computeV2PanelRows(oldValue: DashboardV2Spec, newValue: DashboardV2Spec): PanelChangeRow[] {
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

function computeV2VariableChanges(oldValue: DashboardV2Spec, newValue: DashboardV2Spec): FieldChange[] {
  return diffByName(mapV2VariablesByName(oldValue), mapV2VariablesByName(newValue));
}

function mapV2VariablesByName(spec: DashboardV2Spec): Map<string, VariableKind> {
  const map = new Map<string, VariableKind>();
  for (const variable of spec.variables) {
    map.set(variable.spec.name, variable);
  }
  return map;
}

function computeV2OptionChanges(oldValue: DashboardV2Spec, newValue: DashboardV2Spec): FieldChange[] {
  return diffFields(V2_OPTION_FIELDS, oldValue, newValue);
}

// --- shared diff helpers ---

interface PanelAccessors<T> {
  title: (item: T) => string;
  height: (item: T) => number;
}

function diffById<T>(oldItems: Map<number, T>, newItems: Map<number, T>, accessors: PanelAccessors<T>): PanelChangeRow[] {
  const rows: PanelChangeRow[] = [];
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

function diffByName<T>(oldItems: Map<string, T>, newItems: Map<string, T>): FieldChange[] {
  const changes: FieldChange[] = [];
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
  fields: Array<{ label: string; get: (model: T) => unknown }>,
  oldValue: T,
  newValue: T
): FieldChange[] {
  const changes: FieldChange[] = [];

  for (const { label, get } of fields) {
    const oldText = formatValue(get(oldValue));
    const newText = formatValue(get(newValue));
    if (oldText !== newText) {
      changes.push({ label, type: 'changed', oldText, newText });
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
