import { useEffect, useMemo, useState } from 'react';

import {
  AppEvents,
  type DashboardQueryPolicy,
  type DashboardQueryPolicyContext,
  type DataSourceApi,
  type DataSourceInstanceSettings,
  type ScopedVars,
} from '@grafana/data';
import { getAppEvents } from '@grafana/runtime';
import {
  getDataSourceInstance,
  getDataSourceInstanceList,
  getDataSourceInstanceSettings,
} from '@grafana/runtime/unstable';
import {
  SafeSerializableSceneObject,
  sceneGraph,
  type SceneObject,
  type SceneQueryRunner,
  sceneUtils,
  type VizPanel,
} from '@grafana/scenes';
import { type DataQuery, type DataSourceRef, type VariableModel } from '@grafana/schema';
import { ExpressionDatasourceUID } from 'app/features/expressions/types';
import { SHARED_DASHBOARD_QUERY } from 'app/plugins/datasource/dashboard/constants';
import { MIXED_DATASOURCE_NAME } from 'app/plugins/datasource/mixed/MixedDataSource';

import { DashboardScene } from '../scene/DashboardScene';
import { sceneVariablesSetToVariables } from '../serialization/sceneVariablesSetToVariables';

import { dashboardSceneGraph } from './dashboardSceneGraph';
import { getQueryRunnerFor } from './getQueryRunnerFor';

export interface DashboardQueryPolicyEntry {
  /** UID of the data source instance that declared the policy. */
  uid: string;
  policy: DashboardQueryPolicy;
  /**
   * UIDs of the other instances of this plugin type, resolved when the policy was loaded. They let the
   * synchronous checks judge a reference that carries only a UID. Absent until resolved; the checks
   * then rely on the plugin type the reference carries.
   */
  excludedUids?: string[];
  /** UID of the instance a type-only or `default` reference of this plugin type resolves to. */
  defaultUid?: string;
  /** Whether the organisation's default data source is one of the excluded instances. */
  orgDefaultExcluded?: boolean;
}

/**
 * Policies keyed by data source plugin type. An entry is `undefined` when two instances of the same
 * plugin type both claimed the dashboard; the conflict voids the policy for that type.
 */
export type DashboardQueryPolicies = Record<string, DashboardQueryPolicyEntry | undefined>;

export type DatasourceAllowed = { allowed: true } | { allowed: false; reason: string };

/** A data source reference resolved to the concrete instance it points at. */
export interface ConcreteDatasource {
  type: string;
  uid: string;
}

/**
 * A reference resolved as far as the synchronous checks can take it: the UID it names once variables
 * are interpolated, with the plugin type when the reference carries one. `default` stands for the
 * organisation's default data source.
 */
export interface ResolvedDatasourceRef {
  uid: string;
  type?: string;
}

/** What the policies are computed from. `signature` only changes when a reload could change them. */
export interface DashboardQueryPolicyInputs {
  instances: ConcreteDatasource[];
  variables: VariableModel[];
  signature: string;
}

/** A persisted panel: library panel models and legacy clipboards before they become scene objects. */
interface PanelModelLike {
  datasource?: DataSourceRef | null;
  targets?: Array<Partial<Pick<DataQuery, 'refId' | 'datasource'>>>;
}

/** A panel's queries with their panel-level ref, as kept by a query runner or a panel model. */
interface QuerySet {
  datasource?: DataSourceRef | null;
  queries: Array<Pick<DataQuery, 'refId' | 'datasource'>>;
}

const ALLOWED: DatasourceAllowed = { allowed: true };

/** The UID Grafana uses for "the organisation's default data source". */
const DEFAULT_UID = 'default';

/** Built-in pseudo data sources never carry a policy and are never excluded by one. */
const IGNORED_UIDS = new Set<string>([MIXED_DATASOURCE_NAME, SHARED_DASHBOARD_QUERY, ExpressionDatasourceUID]);

const collator = new Intl.Collator();

/** Scoped vars that let the data source API resolve `$variable` refs through this scene object. */
export function scopedVarsFor(sceneObject: SceneObject): ScopedVars {
  return { __sceneObject: new SafeSerializableSceneObject(sceneObject) };
}

function toRefObject(ref: DataSourceRef | string | null | undefined): DataSourceRef | undefined {
  if (ref == null) {
    return undefined;
  }

  const refObject: DataSourceRef = typeof ref === 'string' ? { uid: ref } : ref;
  if ((!refObject.uid && !refObject.type) || (refObject.uid && IGNORED_UIDS.has(refObject.uid))) {
    return undefined;
  }

  return refObject;
}

/**
 * Resolves a reference to the concrete instance it points at through the data source API: symbolic
 * refs (`$ds`) through the scene's variables (`rawRef` carries the concrete UID), type-only and
 * `default` refs to the instance Grafana would use. An empty ref resolves to nothing, never to the org
 * default; built-in pseudo data sources resolve to nothing as well. An unresolvable concrete-looking
 * ref is judged as written.
 */
export async function resolveConcreteDatasource(
  ref: DataSourceRef | string | null | undefined,
  scopedVars?: ScopedVars
): Promise<ConcreteDatasource | undefined> {
  const refObject = toRefObject(ref);
  if (!refObject) {
    return undefined;
  }

  const settings = await getDataSourceInstanceSettings(refObject, scopedVars);
  if (!settings) {
    if (!refObject.uid || !refObject.type || refObject.uid.includes('$')) {
      return undefined;
    }
    return { type: refObject.type, uid: refObject.uid };
  }

  const uid = settings.rawRef?.uid ?? settings.uid;
  if (!uid || !settings.type || IGNORED_UIDS.has(uid)) {
    return undefined;
  }

  return { type: settings.type, uid };
}

/**
 * Resolves a reference without consulting the data source API, so the checks that guard synchronous
 * editor actions can run: a symbolic UID (`$ds`) is interpolated through `scope`, a type-only or
 * `default` reference becomes the type's default instance when the policies know it, else `default`.
 * Nothing is resolved for an empty ref, a built-in pseudo data source or a variable that does not
 * interpolate; such references are not judged.
 */
export function resolveDatasourceRef(
  ref: DataSourceRef | string | null | undefined,
  scope: SceneObject,
  policies?: DashboardQueryPolicies
): ResolvedDatasourceRef | undefined {
  const refObject = toRefObject(ref);
  if (!refObject) {
    return undefined;
  }

  let uid = refObject.uid;
  if (uid && uid.includes('$')) {
    const interpolated = sceneGraph.interpolate(scope, uid);
    if (!interpolated || interpolated.includes('$')) {
      return undefined;
    }
    uid = interpolated;
  }

  if (!uid || uid === DEFAULT_UID) {
    uid = (refObject.type && policies?.[refObject.type]?.defaultUid) || DEFAULT_UID;
  }

  if (IGNORED_UIDS.has(uid)) {
    return undefined;
  }

  return refObject.type ? { uid, type: refObject.type } : { uid };
}

/** Effective refs of a query runner: a query without its own ref inherits the panel-level one. */
export function getQueryRunnerDatasourceRefs(queryRunner: SceneQueryRunner): Array<DataSourceRef | null | undefined> {
  const panelRef = queryRunner.state.datasource;
  return [panelRef, ...(queryRunner.state.queries ?? []).map((query) => query.datasource ?? panelRef)];
}

function getPanelModelDatasourceRefs(model: PanelModelLike): Array<DataSourceRef | null | undefined> {
  const panelRef = model.datasource;
  return [panelRef, ...(model.targets ?? []).map((target) => target.datasource ?? panelRef)];
}

/**
 * Collects every concrete data source instance the dashboard references (panel-level and effective
 * per-query refs resolved in each panel's own scope, plus query, ad hoc, group-by and data source
 * variables) together with the variables handed to the hook, and a signature of the dashboard UID,
 * the instances and those variables.
 */
export async function collectDashboardQueryPolicyInputs(scene: DashboardScene): Promise<DashboardQueryPolicyInputs> {
  const dashboardScopedVars = scopedVarsFor(scene);
  const lookups: Array<Promise<ConcreteDatasource | undefined>> = [];

  const add = (ref: DataSourceRef | string | null | undefined, scopedVars: ScopedVars) => {
    lookups.push(resolveConcreteDatasource(ref, scopedVars));
  };

  for (const panel of dashboardSceneGraph.getVizPanels(scene)) {
    const queryRunner = getQueryRunnerFor(panel);
    if (!queryRunner) {
      continue;
    }
    // A panel resolves `$ds` through its own scope: row, tab and repeat-local variables included.
    const panelScopedVars = scopedVarsFor(panel);
    for (const ref of getQueryRunnerDatasourceRefs(queryRunner)) {
      add(ref, panelScopedVars);
    }
  }

  const variableSet = sceneGraph.getVariables(scene);
  for (const variable of variableSet.state.variables) {
    if (
      sceneUtils.isQueryVariable(variable) ||
      sceneUtils.isAdHocVariable(variable) ||
      sceneUtils.isGroupByVariable(variable)
    ) {
      add(variable.state.datasource, dashboardScopedVars);
    } else if (sceneUtils.isDataSourceVariable(variable)) {
      const values = Array.isArray(variable.state.value) ? variable.state.value : [variable.state.value];
      for (const value of values) {
        if (typeof value === 'string' && value) {
          add({ type: variable.state.pluginId, uid: value }, dashboardScopedVars);
        }
      }
    }
  }

  const instancesByUid = new Map<string, ConcreteDatasource>();
  for (const instance of await Promise.all(lookups)) {
    if (instance && !instancesByUid.has(instance.uid)) {
      instancesByUid.set(instance.uid, instance);
    }
  }

  const instances = Array.from(instancesByUid.values()).sort((a, b) => collator.compare(a.uid, b.uid));
  // Interval variables follow the time range and carry nothing a data source decides on, so they are
  // not handed to the hook (and cannot trigger a reload).
  const variables = sceneVariablesSetToVariables(variableSet, false).filter((variable) => variable.type !== 'interval');
  const signature = JSON.stringify({
    dashboardUID: scene.state.uid,
    instances: instances.map((instance) => `${instance.type}/${instance.uid}`),
    variables,
  });

  return { instances, variables, signature };
}

/**
 * Asks every referenced data source instance for a dashboard policy. Returns `undefined` when no
 * instance declares one. Two instances of one plugin type both declaring a policy void the entry for
 * that type and log a diagnostic naming both UIDs. Each kept entry also records what the synchronous
 * checks need: the other instances of its plugin type, the type's default instance and whether the
 * organisation's default data source is excluded.
 */
export async function loadDashboardQueryPolicies(
  scene: DashboardScene,
  inputs?: DashboardQueryPolicyInputs
): Promise<DashboardQueryPolicies | undefined> {
  const { instances, variables } = inputs ?? (await collectDashboardQueryPolicyInputs(scene));
  if (instances.length === 0) {
    return undefined;
  }

  const context: DashboardQueryPolicyContext = {
    dashboardUID: scene.state.uid,
    variables,
  };

  const claims = await Promise.all(instances.map((instance) => loadPolicyFromInstance(instance, context)));

  const claimsByType = new Map<string, DashboardQueryPolicyEntry[]>();
  for (const claim of claims) {
    if (!claim) {
      continue;
    }
    const entries = claimsByType.get(claim.type) ?? [];
    entries.push({ uid: claim.uid, policy: claim.policy });
    claimsByType.set(claim.type, entries);
  }

  if (claimsByType.size === 0) {
    return undefined;
  }

  const orgDefault = await getDataSourceInstanceSettings(null);
  const policies: DashboardQueryPolicies = {};
  for (const [type, entries] of claimsByType) {
    if (entries.length === 1) {
      policies[type] = await describeInstances(type, entries[0], orgDefault);
      continue;
    }

    policies[type] = undefined;
    console.warn(
      `Ignoring dashboard query policy for data source type "${type}": more than one instance claims this dashboard (${entries
        .map((e) => e.uid)
        .join(', ')})`
    );
  }

  return policies;
}

interface PolicyClaim {
  type: string;
  uid: string;
  policy: DashboardQueryPolicy;
}

async function loadPolicyFromInstance(
  instance: ConcreteDatasource,
  context: DashboardQueryPolicyContext
): Promise<PolicyClaim | undefined> {
  let ds: DataSourceApi;

  try {
    ds = await getDataSourceInstance(instance);
  } catch {
    // A missing data source is already reported by the panels that use it.
    return undefined;
  }

  if (typeof ds.getDashboardQueryPolicy !== 'function') {
    return undefined;
  }

  try {
    const policy = await ds.getDashboardQueryPolicy(context);
    return policy ? { type: ds.type, uid: ds.uid, policy } : undefined;
  } catch (e) {
    console.warn('Failed to load dashboard query policy from data source', ds.uid, e);
    return undefined;
  }
}

/** Records the other instances of the claiming type and the defaults the synchronous checks judge by. */
async function describeInstances(
  type: string,
  entry: DashboardQueryPolicyEntry,
  orgDefault: DataSourceInstanceSettings | undefined
): Promise<DashboardQueryPolicyEntry> {
  try {
    const [instances, typeDefault] = await Promise.all([
      getDataSourceInstanceList({ type, all: true }),
      getDataSourceInstanceSettings({ type }),
    ]);

    return {
      ...entry,
      excludedUids: instances.map((instance) => instance.uid).filter((uid) => uid !== entry.uid),
      defaultUid: typeDefault?.uid,
      orgDefaultExcluded: orgDefault !== undefined && orgDefault.type === type && orgDefault.uid !== entry.uid,
    };
  } catch (e) {
    // The policy still applies to references that carry their plugin type.
    console.warn('Failed to list data source instances for dashboard query policy', type, e);
    return entry;
  }
}

function hasPolicies(policies: DashboardQueryPolicies | undefined): policies is DashboardQueryPolicies {
  return policies !== undefined && Object.values(policies).some((entry) => entry !== undefined);
}

/** Whether the dashboard has at least one effective policy; a cheap guard before resolving refs. */
export function hasQueryPolicies(scene: DashboardScene): boolean {
  return hasPolicies(scene.state.queryPolicies);
}

function refusedBy(entry: DashboardQueryPolicyEntry): DatasourceAllowed {
  return { allowed: false, reason: entry.policy.reason };
}

/**
 * Whether a resolved reference may be used. A reference that carries its plugin type is judged by that
 * type's entry; any reference is also refused when its UID is one of the excluded instances recorded
 * at load time. The organisation's default is refused when the load found it excluded; a type default
 * the load could not resolve is allowed.
 */
function isResolvedAllowed(policies: DashboardQueryPolicies, { uid, type }: ResolvedDatasourceRef): DatasourceAllowed {
  if (uid === DEFAULT_UID) {
    if (type !== undefined) {
      return ALLOWED;
    }
    for (const entry of Object.values(policies)) {
      if (entry?.orgDefaultExcluded) {
        return refusedBy(entry);
      }
    }
    return ALLOWED;
  }

  if (type !== undefined) {
    const entry = policies[type];
    if (entry && entry.uid !== uid) {
      return refusedBy(entry);
    }
  }

  for (const entry of Object.values(policies)) {
    if (entry && entry.uid !== uid && entry.excludedUids?.includes(uid)) {
      return refusedBy(entry);
    }
  }

  return ALLOWED;
}

/**
 * Whether a data source may be used on the dashboard. Refs that resolve to nothing are allowed; the
 * policy only ever excludes other instances of a claiming plugin type. `scope` is the scene object
 * whose variables resolve a symbolic ref; it defaults to the dashboard.
 */
export function isDatasourceAllowed(
  scene: DashboardScene,
  ref: DataSourceRef | string | null | undefined,
  scope: SceneObject = scene
): DatasourceAllowed {
  const policies = scene.state.queryPolicies;
  if (!hasPolicies(policies)) {
    return ALLOWED;
  }

  const resolved = resolveDatasourceRef(ref, scope, policies);
  return resolved ? isResolvedAllowed(policies, resolved) : ALLOWED;
}

/** The same check from any scene object, resolving refs in that object's scope; allows everything outside a `DashboardScene`. */
export function isDatasourceAllowedFor(
  sceneObject: SceneObject,
  ref: DataSourceRef | string | null | undefined
): DatasourceAllowed {
  const root = sceneObject.getRoot();
  return root instanceof DashboardScene ? isDatasourceAllowed(root, ref, sceneObject) : ALLOWED;
}

function areDatasourceRefsAllowed(
  scene: DashboardScene,
  refs: Array<DataSourceRef | string | null | undefined>,
  scope: SceneObject
): DatasourceAllowed {
  for (const ref of refs) {
    const check = isDatasourceAllowed(scene, ref, scope);
    if (!check.allowed) {
      return check;
    }
  }
  return ALLOWED;
}

/**
 * Checks a change to a panel's queries. A query that keeps its refId and still resolves to the
 * instance it used before is left alone, so a panel that became excluded after a policy change stays
 * editable. Every new query and every changed ref must resolve to an allowed instance, even when the
 * panel already uses that instance elsewhere.
 */
export function areQueryChangesAllowed(
  scene: DashboardScene,
  previous: QuerySet,
  next: QuerySet,
  scope: SceneObject = scene
): DatasourceAllowed {
  const policies = scene.state.queryPolicies;
  if (!hasPolicies(policies)) {
    return ALLOWED;
  }

  const previousUids = new Map<string, string | undefined>();
  for (const query of previous.queries) {
    previousUids.set(query.refId, resolveDatasourceRef(query.datasource ?? previous.datasource, scope, policies)?.uid);
  }

  for (const query of next.queries) {
    const resolved = resolveDatasourceRef(query.datasource ?? next.datasource, scope, policies);
    if (!resolved || (previousUids.has(query.refId) && previousUids.get(query.refId) === resolved.uid)) {
      continue;
    }

    const check = isResolvedAllowed(policies, resolved);
    if (!check.allowed) {
      return check;
    }
  }

  return ALLOWED;
}

/** The same check from any scene object, resolving refs in that object's scope; allows everything outside a dashboard. */
export function areQueryChangesAllowedFor(
  sceneObject: SceneObject,
  previous: QuerySet,
  next: QuerySet
): DatasourceAllowed {
  const root = sceneObject.getRoot();
  return root instanceof DashboardScene ? areQueryChangesAllowed(root, previous, next, sceneObject) : ALLOWED;
}

/** Checks the panel-level and effective per-query refs of a panel's query runner. */
export function isVizPanelAllowed(scene: DashboardScene, panel: VizPanel): DatasourceAllowed {
  if (!hasPolicies(scene.state.queryPolicies)) {
    return ALLOWED;
  }

  const queryRunner = getQueryRunnerFor(panel);
  if (!queryRunner) {
    return ALLOWED;
  }

  // A panel that is not (yet) part of the scene resolves its variables through the dashboard.
  const scope = panel.getRoot() === scene ? panel : scene;
  return areDatasourceRefsAllowed(scene, getQueryRunnerDatasourceRefs(queryRunner), scope);
}

/** Checks a persisted panel model (library panels, legacy clipboards) before it becomes a scene object. */
export function isPanelModelAllowed(scene: DashboardScene, model: PanelModelLike): DatasourceAllowed {
  if (!hasPolicies(scene.state.queryPolicies)) {
    return ALLOWED;
  }

  return areDatasourceRefsAllowed(scene, getPanelModelDatasourceRefs(model), scene);
}

/** Picker entries carry their concrete identity (`rawRef` for a variable entry), so no resolution is needed. */
function filterForPolicies(policies: DashboardQueryPolicies) {
  return (ds: DataSourceInstanceSettings) => {
    const uid = ds.rawRef?.uid ?? ds.uid;
    return IGNORED_UIDS.has(uid) || isResolvedAllowed(policies, { uid, type: ds.type }).allowed;
  };
}

/** A picker predicate hiding excluded instances, or `undefined` when the dashboard has no policy. */
export function datasourceFilterFor(scene: DashboardScene): ((ds: DataSourceInstanceSettings) => boolean) | undefined {
  const policies = scene.state.queryPolicies;
  return hasPolicies(policies) ? filterForPolicies(policies) : undefined;
}

function sortedPolicyTypes(policies: DashboardQueryPolicies): string[] {
  return Object.keys(policies).sort();
}

/**
 * UID of the instance new panels should default to, when a policy asks for it. When several plugin
 * types ask, the lowest plugin type id wins so the choice is deterministic.
 */
export function defaultDatasourceFor(scene: DashboardScene): string | undefined {
  const policies = scene.state.queryPolicies;
  if (!hasPolicies(policies)) {
    return undefined;
  }

  for (const type of sortedPolicyTypes(policies)) {
    const entry = policies[type];
    if (entry?.policy.defaultForNewPanels) {
      return entry.uid;
    }
  }

  return undefined;
}

/**
 * Reference a new panel or query should start on, resolved from any scene object: the instance a
 * policy asks for, else the claiming instance of the organisation default's plugin type when that
 * default is an excluded instance. `undefined` keeps Grafana's usual default.
 */
export function getNewPanelDatasourceFor(sceneObject: SceneObject): DataSourceRef | undefined {
  const root = sceneObject.getRoot();
  if (!(root instanceof DashboardScene)) {
    return undefined;
  }

  const policies = root.state.queryPolicies;
  if (!hasPolicies(policies)) {
    return undefined;
  }

  const types = sortedPolicyTypes(policies);
  const type =
    types.find((candidate) => policies[candidate]?.policy.defaultForNewPanels) ??
    types.find((candidate) => policies[candidate]?.orgDefaultExcluded);
  const entry = type ? policies[type] : undefined;

  return type && entry ? { type, uid: entry.uid } : undefined;
}

/**
 * Picker predicate for a scene object inside a dashboard, kept in sync with the dashboard's
 * `queryPolicies` only (not the rest of its state) so an open picker updates when policies finish
 * loading. `undefined` outside a `DashboardScene` or when the dashboard has no policy.
 */
export function useDashboardDatasourceFilter(
  sceneObject: SceneObject
): ((ds: DataSourceInstanceSettings) => boolean) | undefined {
  const root = sceneObject.getRoot();
  const dashboard = root instanceof DashboardScene ? root : undefined;
  const [policies, setPolicies] = useState(dashboard?.state.queryPolicies);

  useEffect(() => {
    if (!dashboard) {
      return;
    }

    const sync = (next: DashboardQueryPolicies | undefined) =>
      setPolicies((current) => (current === next ? current : next));
    sync(dashboard.state.queryPolicies);

    const subscription = dashboard.subscribeToState((newState, prevState) => {
      if (newState.queryPolicies !== prevState.queryPolicies) {
        sync(newState.queryPolicies);
      }
    });

    return () => subscription.unsubscribe();
  }, [dashboard]);

  return useMemo(() => (hasPolicies(policies) ? filterForPolicies(policies) : undefined), [policies]);
}

/** Surfaces a refused change with the policy's reason, the way paste errors are surfaced. */
export function notifyQueryPolicyRefusal(title: string, reason: string) {
  getAppEvents().publish({ type: AppEvents.alertError.name, payload: [title, reason] });
}
