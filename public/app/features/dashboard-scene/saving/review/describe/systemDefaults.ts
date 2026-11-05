import { isEqual } from 'lodash';

import { FieldColorModeId, FieldConfigProperty, fieldColorModeRegistry, type PanelPlugin } from '@grafana/data';
import {
  defaultAdhocVariableSpec,
  defaultAnnotationQuerySpec,
  defaultConstantVariableSpec,
  defaultCustomVariableSpec,
  defaultDashboardLink,
  defaultDataLink,
  defaultDataQueryKind,
  defaultDatasourceVariableSpec,
  defaultGroupByVariableSpec,
  defaultIntervalVariableSpec,
  defaultPanelQuerySpec,
  defaultQueryVariableSpec,
  defaultSpec,
  defaultSwitchVariableSpec,
  defaultTextVariableSpec,
  defaultTimeSettingsSpec,
  defaultTransformationSpec,
  type Spec as DashboardV2Spec,
} from '@grafana/schema/apis/dashboard.grafana.app/v2';
import { isRecord } from 'app/core/utils/isRecord';
import { sortedDeepCloneWithoutNulls } from 'app/core/utils/object';

import { type Diff } from '../../../settings/version-history/utils';

import { hasValueAt, isUnset, safely, valueAt } from './paths';

const NOT_A_DEFAULT = Symbol('not a default');
type DefaultValue = unknown | typeof NOT_A_DEFAULT;

export interface DefaultsContext {
  baseline: DashboardV2Spec;
  payload: DashboardV2Spec;
  getPlugin?: (pluginId: string) => PanelPlugin | undefined;
}

/**
 * A two-way classifier: a diff is a value Grafana filled in when the baseline doesn't set it and the payload's
 * value equals the plugin, field config or schema default. Anything it can't establish is a user change.
 */
export function isSystemDefault(diff: Diff, ctx: DefaultsContext): boolean {
  return isDefaultValue(diff.path, diff.op, diff.value, (path) => hasValueAt(ctx.baseline, path), ctx);
}

/**
 * The same test for a value inside a list item that moved: `baselineHas` answers for the matched baseline item.
 */
export function isDefaultValue(
  path: string[],
  op: Diff['op'],
  value: unknown,
  baselineHas: (path: string[]) => boolean,
  ctx: DefaultsContext
): boolean {
  // Grafana writes the plugin version: filled in on load, bumped by an upgrade. Never the user's edit.
  if (isPluginVersion(path)) {
    return (op === 'add' || op === 'replace') && !isUnset(value);
  }
  if (op !== 'add' || baselineHas(path)) {
    return false;
  }
  if (value === false) {
    return true;
  }
  const expected = defaultAt(path, ctx);
  return expected !== NOT_A_DEFAULT && matchesDefault(value, expected);
}

function isPluginVersion(path: string[]): boolean {
  return path.length === 5 && path[0] === 'elements' && path[3] === 'vizConfig' && path[4] === 'version';
}

/** Compared the way the serializer writes both sides: sorted, without nulls, ±Infinity as 0. */
function matchesDefault(value: unknown, expected: unknown): boolean {
  return isEqual(
    withoutBaseStepValue(sortedDeepCloneWithoutNulls(value, true)),
    withoutBaseStepValue(sortedDeepCloneWithoutNulls(expected, true))
  );
}

/** A thresholds base step always means −∞, however it was written (−Infinity, 0, null or left out). */
function withoutBaseStepValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(withoutBaseStepValue);
  }
  if (!isRecord(value)) {
    return value;
  }
  const copy: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    copy[key] = withoutBaseStepValue(item);
  }
  if (Array.isArray(copy.steps) && isRecord(copy.steps[0])) {
    const { value: base, ...first } = copy.steps[0];
    copy.steps = [first, ...copy.steps.slice(1)];
  }
  return copy;
}

function defaultAt(path: string[], ctx: DefaultsContext): DefaultValue {
  const [head, ...rest] = path;
  switch (head) {
    case 'elements':
      return elementDefaultAt(rest, ctx);
    case 'layout':
      return NOT_A_DEFAULT;
    case 'timeSettings':
      return lookup(defaultTimeSettingsSpec(), rest);
    case 'variables':
      return listItemDefaultAt(rest, (index) => variableDefault(valueAt(ctx.payload, ['variables', index, 'kind'])));
    case 'annotations':
      return listItemDefaultAt(rest, () => ({ kind: 'AnnotationQuery', spec: annotationDefault() }));
    case 'links':
      return listItemDefaultAt(rest, () => withoutPlacement(defaultDashboardLink()));
    case 'liveNow':
      return rest.length ? NOT_A_DEFAULT : false;
    default:
      return lookup(defaultSpec(), path);
  }
}

function elementDefaultAt(path: string[], ctx: DefaultsContext): DefaultValue {
  const [name, kindOrSpec, ...rest] = path;
  if (kindOrSpec !== 'spec' || !rest.length) {
    return NOT_A_DEFAULT;
  }
  const element = valueAt(ctx.payload, ['elements', name]);
  if (!isRecord(element) || element.kind !== 'Panel') {
    return NOT_A_DEFAULT;
  }
  const [field, ...below] = rest;
  switch (field) {
    // The serializer always writes the panel description, '' when there is none.
    case 'description':
      return below.length ? NOT_A_DEFAULT : '';
    case 'transparent':
      return below.length ? NOT_A_DEFAULT : false;
    case 'links':
      return listItemDefaultAt(below, () => defaultDataLink(), []);
    case 'data':
      return dataDefaultAt(below);
    case 'vizConfig':
      return vizConfigDefaultAt(name, below, valueAt(element, ['spec', 'vizConfig', 'group']), ctx);
    default:
      return NOT_A_DEFAULT;
  }
}

function dataDefaultAt(path: string[]): DefaultValue {
  if (path[0] !== 'spec') {
    return NOT_A_DEFAULT;
  }
  const [field, ...below] = path.slice(1);
  switch (field) {
    case 'queries':
      return listItemDefaultAt(below, () => ({ kind: 'PanelQuery', spec: queryDefault() }), []);
    case 'transformations':
      return listItemDefaultAt(below, () => ({ spec: defaultTransformationSpec() }), []);
    case 'queryOptions':
      return below.length ? NOT_A_DEFAULT : {};
    default:
      return NOT_A_DEFAULT;
  }
}

function vizConfigDefaultAt(element: string, path: string[], pluginId: unknown, ctx: DefaultsContext): DefaultValue {
  if (path[0] !== 'spec') {
    return NOT_A_DEFAULT;
  }
  const plugin = typeof pluginId === 'string' ? safely(() => ctx.getPlugin?.(pluginId)) : undefined;
  const [field, ...below] = path.slice(1);
  if (field === 'options') {
    if (!below.length) {
      return plugin ? (safely(() => plugin.defaults) ?? {}) : {};
    }
    return plugin ? lookup(safely(() => plugin.defaults) ?? {}, below) : NOT_A_DEFAULT;
  }
  if (field === 'fieldConfig') {
    const [part, ...rest] = below;
    if (!part) {
      return { defaults: {}, overrides: [] };
    }
    if (part === 'overrides') {
      return rest.length ? NOT_A_DEFAULT : [];
    }
    if (part === 'defaults') {
      const previous = valueAt(ctx.baseline, ['elements', element, 'spec', 'vizConfig']);
      if (plugin && rest.length === 1 && rest[0] === 'color' && isRecord(previous) && previous.group !== pluginId) {
        const adapted = colorAfterPluginChange(plugin, valueAt(previous, ['spec', 'fieldConfig', 'defaults', 'color']));
        if (adapted) {
          return adapted;
        }
      }
      if (!rest.length) {
        return plugin ? (safely(() => plugin.fieldConfigDefaults.defaults) ?? {}) : {};
      }
      return plugin ? lookup(safely(() => plugin.fieldConfigDefaults.defaults) ?? {}, rest) : NOT_A_DEFAULT;
    }
  }
  return NOT_A_DEFAULT;
}

/**
 * The color `getPanelOptionsWithDefaults` picks when a panel switches to `plugin`: classic palette for
 * plugins without value colors, thresholds for those that prefer them.
 */
function colorAfterPluginChange(plugin: PanelPlugin, previous: unknown): { mode: string } | undefined {
  const settings = safely(() => plugin.fieldConfigRegistry.getIfExists(FieldConfigProperty.Color)?.settings);
  if (!isRecord(settings)) {
    return undefined;
  }
  const previousMode = valueAt(previous, ['mode']);
  const mode = typeof previousMode === 'string' ? fieldColorModeRegistry.getIfExists(previousMode) : undefined;
  if (!settings.byValueSupport && (!mode || mode.isByValue)) {
    return { mode: FieldColorModeId.PaletteClassic };
  }
  if (settings.byValueSupport && settings.preferThresholdsMode && mode?.id !== FieldColorModeId.Fixed) {
    if (!mode || !mode.isByValue) {
      return { mode: FieldColorModeId.Thresholds };
    }
  }
  if (settings.bySeriesSupport && mode?.isByValue) {
    return { mode: FieldColorModeId.PaletteClassic };
  }
  return undefined;
}

/** For a list path (`[]`, `[index]` or `[index, ...field]`), the default of the item's field. */
function listItemDefaultAt(path: string[], itemDefault: (index: string) => unknown, listDefault?: unknown[]) {
  const [index, ...rest] = path;
  if (index === undefined) {
    return listDefault ?? NOT_A_DEFAULT;
  }
  if (!rest.length) {
    return NOT_A_DEFAULT;
  }
  return lookup(itemDefault(index), rest);
}

function lookup(root: unknown, path: string[]): DefaultValue {
  const value = valueAt(root, path);
  return value === undefined ? NOT_A_DEFAULT : value;
}

function queryDefault() {
  const { query, ...rest } = defaultPanelQuerySpec();
  const { refId, ...withoutRefId } = rest;
  const { group, ...queryWithoutGroup } = query;
  return { ...withoutRefId, query: { ...queryWithoutGroup, spec: {} } };
}

function annotationDefault() {
  const { placement, query, ...rest } = defaultAnnotationQuerySpec();
  const { group, ...queryWithoutGroup } = defaultDataQueryKind();
  return { ...rest, query: queryWithoutGroup };
}

function withoutPlacement<T extends { placement?: unknown }>(value: T): Omit<T, 'placement'> {
  const { placement, ...rest } = value;
  return rest;
}

/** A variable kind's schema defaults, as `{ spec }`. */
export function variableDefault(kind: unknown): unknown {
  switch (kind) {
    case 'QueryVariable':
      return { spec: defaultQueryVariableSpec() };
    case 'TextVariable':
      return { spec: defaultTextVariableSpec() };
    case 'ConstantVariable':
      return { spec: defaultConstantVariableSpec() };
    case 'DatasourceVariable':
      return { spec: defaultDatasourceVariableSpec() };
    case 'IntervalVariable':
      return { spec: defaultIntervalVariableSpec() };
    case 'CustomVariable':
      return { spec: defaultCustomVariableSpec() };
    case 'GroupByVariable':
      return { spec: defaultGroupByVariableSpec() };
    case 'AdhocVariable':
      return { spec: defaultAdhocVariableSpec() };
    case 'SwitchVariable':
      return { spec: defaultSwitchVariableSpec() };
    default:
      return {};
  }
}
