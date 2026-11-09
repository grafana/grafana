import { cloneDeep, isEqual } from 'lodash';

import { getPanelOptionsWithDefaults, type OptionDefaults, type PanelPlugin } from '@grafana/data';
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

import { isUnset, safely, valueAt } from './paths';

const NOT_A_DEFAULT = Symbol('not a default');
type DefaultValue = unknown | typeof NOT_A_DEFAULT;

export interface DefaultsContext {
  baseline: DashboardV2Spec;
  payload: DashboardV2Spec;
  getPlugin?: (pluginId: string) => PanelPlugin | undefined;
  /** Whether a panel switched visualization type (`typeChanged` in rules.ts). */
  pluginChanged?: (element: string) => boolean;
}

/**
 * A two-way classifier: a diff is a value Grafana filled in when the baseline doesn't set it and the payload's
 * value equals the plugin, field config or schema default. Anything it can't establish is a user change.
 */
export function isSystemDefault(diff: Diff, ctx: DefaultsContext): boolean {
  // compare only adds what the baseline lacks.
  return isDefaultValue(diff.path, diff.op, diff.value, () => false, ctx);
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
  return isEqual(asWritten(value), asWritten(expected));
}

function asWritten(value: unknown): unknown {
  return sortedDeepCloneWithoutNulls({ value }, true).value;
}

function defaultAt(path: string[], ctx: DefaultsContext): DefaultValue {
  const [head, ...rest] = path;
  switch (head) {
    case 'elements':
      return elementDefaultAt(rest, ctx);
    case 'layout':
      return NOT_A_DEFAULT;
    case 'timeSettings':
      return lookup(schemaDefaults.timeSettings(), rest);
    case 'variables':
      return listItemDefaultAt(rest, (index) => variableDefault(valueAt(ctx.payload, ['variables', index, 'kind'])));
    case 'annotations':
      return listItemDefaultAt(rest, schemaDefaults.annotation);
    case 'links':
      return listItemDefaultAt(rest, schemaDefaults.dashboardLink);
    case 'liveNow':
      return rest.length ? NOT_A_DEFAULT : false;
    default:
      return lookup(schemaDefaults.dashboard(), path);
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
      return listItemDefaultAt(below, schemaDefaults.dataLink, []);
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
      return listItemDefaultAt(below, schemaDefaults.query, []);
    case 'transformations':
      return listItemDefaultAt(below, schemaDefaults.transformation, []);
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
  const [field, part, ...rest] = path.slice(1);
  if (field === 'fieldConfig' && part !== 'defaults') {
    if (part === undefined) {
      return { defaults: {}, overrides: [] };
    }
    return part === 'overrides' && !rest.length ? [] : NOT_A_DEFAULT;
  }
  if (field !== 'options' && field !== 'fieldConfig') {
    return NOT_A_DEFAULT;
  }
  const plugin = typeof pluginId === 'string' ? safely(() => ctx.getPlugin?.(pluginId)) : undefined;
  const written = plugin ? safely(() => writtenBy(plugin, element, ctx)) : undefined;
  const root: unknown = field === 'options' ? written?.options : written?.fieldConfig.defaults;
  const below = field === 'options' ? path.slice(2) : rest;
  if (!below.length) {
    return root ?? {};
  }
  return root ? lookup(root, below) : NOT_A_DEFAULT;
}

/**
 * What `VizPanel` writes once `plugin` is loaded: its defaults, or after a visualization change, the panel's previous
 * field config adapted to it, with custom options cleared as the panel editor does before `changePluginType`.
 */
function writtenBy(plugin: PanelPlugin, element: string, ctx: DefaultsContext): OptionDefaults {
  const isAfterPluginChange = ctx.pluginChanged?.(element) ?? false;
  // The result only depends on the plugin, the baseline element and whether the type changed, and every diff of
  // the element asks for it: compute it once per element.
  const byPlugin = getOrSet(writtenCache, ctx.baseline, () => new WeakMap<PanelPlugin, Map<string, OptionDefaults>>());
  const byElement = getOrSet(byPlugin, plugin, () => new Map<string, OptionDefaults>());
  const key = `${isAfterPluginChange}/${element}`;
  return getOrSet(byElement, key, () => {
    const previous = isAfterPluginChange
      ? valueAt(ctx.baseline, ['elements', element, 'spec', 'vizConfig', 'spec', 'fieldConfig', 'defaults'])
      : undefined;
    return getPanelOptionsWithDefaults({
      plugin,
      currentOptions: {},
      // Cloned because getPanelOptionsWithDefaults fixes thresholds in place. Overrides don't affect the defaults.
      currentFieldConfig: { defaults: { ...cloneDeep(isRecord(previous) ? previous : {}), custom: {} }, overrides: [] },
      isAfterPluginChange,
    });
  });
}

const writtenCache = new WeakMap<DashboardV2Spec, WeakMap<PanelPlugin, Map<string, OptionDefaults>>>();

function getOrSet<K, V>(map: { get(key: K): V | undefined; set(key: K, value: V): unknown }, key: K, make: () => V): V {
  const cached = map.get(key);
  if (cached !== undefined) {
    return cached;
  }
  const value = make();
  map.set(key, value);
  return value;
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

/** The schema's defaults are pure: each is built once, on first use, and frozen because every summary shares it. */
function shared<T>(make: () => T): () => T {
  let value: T | undefined;
  return () => (value ??= deepFreeze(make()));
}

function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
  }
  return value;
}

const schemaDefaults = {
  dashboard: shared(defaultSpec),
  timeSettings: shared(defaultTimeSettingsSpec),
  annotation: shared(() => {
    const { placement, query, ...rest } = defaultAnnotationQuerySpec();
    const { group, ...queryWithoutGroup } = defaultDataQueryKind();
    return { kind: 'AnnotationQuery', spec: { ...rest, query: queryWithoutGroup } };
  }),
  dashboardLink: shared(() => {
    const { placement, ...rest } = defaultDashboardLink();
    return rest;
  }),
  dataLink: shared(defaultDataLink),
  query: shared(() => {
    const { query, refId, ...rest } = defaultPanelQuerySpec();
    const { group, ...queryWithoutGroup } = query;
    return { kind: 'PanelQuery', spec: { ...rest, query: { ...queryWithoutGroup, spec: {} } } };
  }),
  transformation: shared(() => ({ spec: defaultTransformationSpec() })),
};

const variableDefaults: Record<string, () => unknown> = {
  QueryVariable: shared(() => ({ spec: defaultQueryVariableSpec() })),
  TextVariable: shared(() => ({ spec: defaultTextVariableSpec() })),
  ConstantVariable: shared(() => ({ spec: defaultConstantVariableSpec() })),
  DatasourceVariable: shared(() => ({ spec: defaultDatasourceVariableSpec() })),
  IntervalVariable: shared(() => ({ spec: defaultIntervalVariableSpec() })),
  CustomVariable: shared(() => ({ spec: defaultCustomVariableSpec() })),
  GroupByVariable: shared(() => ({ spec: defaultGroupByVariableSpec() })),
  AdhocVariable: shared(() => ({ spec: defaultAdhocVariableSpec() })),
  SwitchVariable: shared(() => ({ spec: defaultSwitchVariableSpec() })),
};

/** A variable kind's schema defaults, as `{ spec }`. */
export function variableDefault(kind: unknown): unknown {
  return typeof kind === 'string' && Object.hasOwn(variableDefaults, kind) ? variableDefaults[kind]() : {};
}
