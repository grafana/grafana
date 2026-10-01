import { act, renderHook } from '@testing-library/react';

import {
  AppEvents,
  type DashboardQueryPolicy,
  type DashboardQueryPolicyContext,
  type DataQuery,
  type DataSourceApi,
  type DataSourceInstanceSettings,
  type DataSourceRef,
  type ScopedVars,
} from '@grafana/data';
import { config } from '@grafana/runtime';
import {
  AdHocFiltersVariable,
  ConstantVariable,
  DataSourceVariable,
  GroupByVariable,
  IntervalVariable,
  QueryVariable,
  SceneDataTransformer,
  SceneGridLayout,
  sceneGraph,
  type SceneObject,
  SceneQueryRunner,
  SceneTimeRange,
  type SceneVariable,
  SceneVariableSet,
  VizPanel,
} from '@grafana/scenes';
import { mockDataSource } from 'app/features/alerting/unified/mocks';
import { SHARED_DASHBOARD_QUERY } from 'app/plugins/datasource/dashboard/constants';
import { MIXED_DATASOURCE_NAME } from 'app/plugins/datasource/mixed/MixedDataSource';

import { DashboardScene } from '../scene/DashboardScene';
import { DashboardGridItem } from '../scene/layout-default/DashboardGridItem';
import { DefaultGridLayoutManager } from '../scene/layout-default/DefaultGridLayoutManager';

import {
  areQueryChangesAllowed,
  collectDashboardQueryPolicyInputs,
  type DashboardQueryPolicies,
  type DashboardQueryPolicyEntry,
  datasourceFilterFor,
  defaultDatasourceFor,
  getNewPanelDatasourceFor,
  getQueryRunnerDatasourceRefs,
  isDatasourceAllowed,
  isDatasourceAllowedFor,
  isPanelModelAllowed,
  isVizPanelAllowed,
  loadDashboardQueryPolicies,
  notifyQueryPolicyRefusal,
  resolveConcreteDatasource,
  resolveDatasourceRef,
  useDashboardDatasourceFilter,
} from './dashboardQueryPolicies';

const RESTRICTED = 'restricted-datasource';

const mockDataSources: Record<string, DataSourceApi> = {};
const mockSettings: Record<string, DataSourceInstanceSettings> = {};
let mockDefaultUid = 'testdata';
let mockListError: Error | undefined;
const mockPublish = jest.fn();

function uidOf(ref: DataSourceRef | string | null | undefined) {
  return typeof ref === 'string' ? ref : ref?.uid;
}

/** Mirrors the data source API's settings lookup: UID, `default`, type-only and `$variable` refs. */
const mockGetInstanceSettings = jest.fn(
  async (ref: DataSourceRef | string | null | undefined, scopedVars?: ScopedVars) => {
    const uid = uidOf(ref);
    if (uid === undefined || uid === null || uid === 'default') {
      const type = typeof ref === 'object' ? ref?.type : undefined;
      const ofType = type ? Object.values(mockSettings).find((s) => s.type === type) : undefined;
      return ofType ?? mockSettings[mockDefaultUid];
    }
    if (uid.includes('$')) {
      const scope: unknown = scopedVars?.__sceneObject?.valueOf();
      const interpolated = isSceneObject(scope) ? sceneGraph.interpolate(scope, uid) : uid;
      const target = interpolated !== uid ? mockSettings[interpolated] : undefined;
      return target ? { ...target, uid, name: uid, rawRef: { type: target.type, uid: target.uid } } : undefined;
    }
    return mockSettings[uid];
  }
);

function isSceneObject(value: unknown): value is SceneObject {
  return typeof value === 'object' && value !== null && 'state' in value && 'getRoot' in value;
}

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getAppEvents: () => ({ publish: mockPublish }),
}));

jest.mock('@grafana/runtime/unstable', () => ({
  ...jest.requireActual('@grafana/runtime/unstable'),
  getDataSourceInstance: (ref: DataSourceRef | string | null | undefined) => {
    const uid = uidOf(ref);
    const ds = uid ? mockDataSources[uid] : undefined;
    return ds ? Promise.resolve(ds) : Promise.reject(new Error(`Datasource ${uid} was not found`));
  },
  getDataSourceInstanceSettings: (ref: DataSourceRef | string | null | undefined, scopedVars?: ScopedVars) =>
    mockGetInstanceSettings(ref, scopedVars),
  getDataSourceInstanceList: async ({ type }: { type?: string | string[] } = {}) => {
    if (mockListError) {
      throw mockListError;
    }
    return Object.values(mockSettings)
      .filter((settings) => !type || settings.type === type)
      .map((settings) => ({ uid: settings.uid, name: settings.name, type: settings.type }));
  },
}));

const policyA: DashboardQueryPolicy = {
  restrictSamePluginToThisInstance: true,
  defaultForNewPanels: true,
  reason: 'Dashboard is bound to instance A. Panels of this type must use data source A.',
};

const policyB: DashboardQueryPolicy = {
  restrictSamePluginToThisInstance: true,
  reason: 'Dashboard is bound to instance B.',
};

function registerDataSource(
  uid: string,
  type: string,
  getDashboardQueryPolicy?: DataSourceApi['getDashboardQueryPolicy']
) {
  mockSettings[uid] = mockDataSource({ uid, type, name: uid }, { id: type });
  mockDataSources[uid] = {
    uid,
    type,
    name: uid,
    meta: { id: type },
    getRef: () => ({ uid, type }),
    getDashboardQueryPolicy,
  } as unknown as DataSourceApi;
  return mockDataSources[uid];
}

/** Mirrors a data source that claims the dashboard only when a `tenant` constant is present. */
function claimWhenBound(policy: DashboardQueryPolicy) {
  return jest.fn(async (context: DashboardQueryPolicyContext) => {
    const bound = context.variables.find((v) => v.type === 'constant' && v.name === 'tenant');
    return bound ? policy : undefined;
  });
}

interface PanelSpec {
  key: string;
  datasource?: DataSourceRef;
  queries?: Array<{ refId: string; datasource?: DataSourceRef; expr?: string }>;
  noData?: boolean;
}

function buildPanel({ key, datasource, queries, noData }: PanelSpec): VizPanel {
  return new VizPanel({
    key,
    title: key,
    pluginId: noData ? 'text' : 'timeseries',
    $data: noData
      ? undefined
      : new SceneDataTransformer({
          transformations: [],
          $data: new SceneQueryRunner({ datasource, queries: queries ?? [{ refId: 'A' }] }),
        }),
  });
}

function buildScene({ panels, variables = [] }: { panels: VizPanel[]; variables?: SceneVariable[] }) {
  return new DashboardScene({
    uid: 'dash-1',
    title: 'Bound dashboard',
    $timeRange: new SceneTimeRange({ from: 'now-6h', to: 'now' }),
    $variables: new SceneVariableSet({ variables }),
    body: new DefaultGridLayoutManager({
      grid: new SceneGridLayout({
        children: panels.map((panel) => new DashboardGridItem({ key: `griditem-${panel.state.key}`, body: panel })),
      }),
    }),
  });
}

const tenantVariable = () => new ConstantVariable({ name: 'tenant', value: 'acme' });
/** The `$ds` data source variable, pointing at instance A unless a test moves it. */
const dsVariable = (uid = 'instance-a') =>
  new DataSourceVariable({ name: 'ds', pluginId: RESTRICTED, value: uid, text: uid });

const refA: DataSourceRef = { type: RESTRICTED, uid: 'instance-a' };
const refB: DataSourceRef = { type: RESTRICTED, uid: 'instance-b' };
const refVar: DataSourceRef = { type: RESTRICTED, uid: '$ds' };
const promRef: DataSourceRef = { type: 'prometheus', uid: 'prom' };

/** The entry a load produces for instance A with instances A and B registered and `testdata` as the org default. */
const boundEntry: DashboardQueryPolicyEntry = {
  uid: 'instance-a',
  policy: policyA,
  excludedUids: ['instance-b'],
  defaultUid: 'instance-a',
  orgDefaultExcluded: false,
};
const boundPolicies: DashboardQueryPolicies = { [RESTRICTED]: boundEntry };

describe('dashboardQueryPolicies', () => {
  beforeEach(() => {
    for (const key of Object.keys(mockDataSources)) {
      delete mockDataSources[key];
    }
    for (const key of Object.keys(mockSettings)) {
      delete mockSettings[key];
    }
    mockDefaultUid = 'testdata';
    mockListError = undefined;
    mockPublish.mockClear();
    mockGetInstanceSettings.mockClear();
    registerDataSource('prom', 'prometheus');
    registerDataSource('testdata', 'grafana-testdata-datasource');
    registerDataSource('instance-a', RESTRICTED);
    registerDataSource('instance-b', RESTRICTED);
  });

  describe('resolveConcreteDatasource', () => {
    it('resolves nothing for empty refs and never falls back to the org default', async () => {
      expect(await resolveConcreteDatasource(undefined)).toBeUndefined();
      expect(await resolveConcreteDatasource(null)).toBeUndefined();
      expect(await resolveConcreteDatasource({})).toBeUndefined();
    });

    it('resolves nothing for the built-in pseudo data sources', async () => {
      expect(await resolveConcreteDatasource({ type: 'datasource', uid: MIXED_DATASOURCE_NAME })).toBeUndefined();
      expect(await resolveConcreteDatasource({ type: 'datasource', uid: SHARED_DASHBOARD_QUERY })).toBeUndefined();
      expect(await resolveConcreteDatasource({ type: '__expr__', uid: '__expr__' })).toBeUndefined();
    });

    it('resolves concrete, symbolic, type-only and default refs to the instance they point at', async () => {
      const scene = buildScene({ panels: [], variables: [dsVariable()] });
      const scopedVars = { __sceneObject: { value: scene, valueOf: () => scene } } as unknown as ScopedVars;

      expect(await resolveConcreteDatasource(refB)).toEqual({ type: RESTRICTED, uid: 'instance-b' });
      expect(await resolveConcreteDatasource('instance-b')).toEqual({ type: RESTRICTED, uid: 'instance-b' });
      expect(await resolveConcreteDatasource(refVar, scopedVars)).toEqual({ type: RESTRICTED, uid: 'instance-a' });
      expect(await resolveConcreteDatasource({ type: 'prometheus' })).toEqual({ type: 'prometheus', uid: 'prom' });
      expect(await resolveConcreteDatasource({ uid: 'default' })).toEqual({
        type: 'grafana-testdata-datasource',
        uid: 'testdata',
      });
    });

    it('judges an unresolvable concrete ref as written and gives up on an unresolvable symbolic ref', async () => {
      expect(await resolveConcreteDatasource({ type: RESTRICTED, uid: 'instance-c' })).toEqual({
        type: RESTRICTED,
        uid: 'instance-c',
      });
      expect(await resolveConcreteDatasource({ uid: 'unknown' })).toBeUndefined();
      expect(await resolveConcreteDatasource({ type: RESTRICTED, uid: '$missing' })).toBeUndefined();
    });
  });

  describe('resolveDatasourceRef', () => {
    const scene = buildScene({ panels: [], variables: [dsVariable()] });

    it('resolves nothing for empty refs, built-ins and variables that do not interpolate', () => {
      expect(resolveDatasourceRef(undefined, scene)).toBeUndefined();
      expect(resolveDatasourceRef(null, scene)).toBeUndefined();
      expect(resolveDatasourceRef({}, scene)).toBeUndefined();
      expect(resolveDatasourceRef({ type: 'datasource', uid: MIXED_DATASOURCE_NAME }, scene)).toBeUndefined();
      expect(resolveDatasourceRef({ type: RESTRICTED, uid: '$missing' }, scene)).toBeUndefined();
    });

    it('keeps concrete refs as written and interpolates symbolic ones through the scope', () => {
      expect(resolveDatasourceRef(refB, scene)).toEqual({ type: RESTRICTED, uid: 'instance-b' });
      expect(resolveDatasourceRef('instance-b', scene)).toEqual({ uid: 'instance-b' });
      expect(resolveDatasourceRef(refVar, scene)).toEqual({ type: RESTRICTED, uid: 'instance-a' });
    });

    it("resolves type-only and default refs to the type's default when the policies know it", () => {
      expect(resolveDatasourceRef({ type: RESTRICTED }, scene, boundPolicies)).toEqual({
        type: RESTRICTED,
        uid: 'instance-a',
      });
      expect(resolveDatasourceRef({ type: RESTRICTED, uid: 'default' }, scene, boundPolicies)).toEqual({
        type: RESTRICTED,
        uid: 'instance-a',
      });
      expect(resolveDatasourceRef({ type: 'prometheus' }, scene, boundPolicies)).toEqual({
        type: 'prometheus',
        uid: 'default',
      });
      expect(resolveDatasourceRef({ uid: 'default' }, scene, boundPolicies)).toEqual({ uid: 'default' });
    });
  });

  describe('getQueryRunnerDatasourceRefs', () => {
    it('lets a query without its own ref inherit the panel-level ref', () => {
      const runner = new SceneQueryRunner({
        datasource: refA,
        queries: [{ refId: 'A' }, { refId: 'B', datasource: promRef }],
      });

      expect(getQueryRunnerDatasourceRefs(runner)).toEqual([refA, refA, promRef]);
    });
  });

  describe('collectDashboardQueryPolicyInputs', () => {
    it('lists each concrete instance once, resolving symbolic and inherited refs and skipping built-ins', async () => {
      const scene = buildScene({
        panels: [
          buildPanel({ key: 'panel-1', datasource: refA }),
          buildPanel({ key: 'panel-2', datasource: refVar, queries: [{ refId: 'A' }] }),
          buildPanel({
            key: 'panel-3',
            datasource: { type: 'datasource', uid: MIXED_DATASOURCE_NAME },
            queries: [
              { refId: 'A', datasource: refB },
              { refId: 'B', datasource: promRef },
              { refId: 'C', datasource: { type: '__expr__', uid: '__expr__' } },
            ],
          }),
          buildPanel({ key: 'panel-4', datasource: { type: 'datasource', uid: SHARED_DASHBOARD_QUERY } }),
          buildPanel({ key: 'panel-5', noData: true }),
        ],
        variables: [dsVariable()],
      });

      const { instances } = await collectDashboardQueryPolicyInputs(scene);

      expect(instances.map((i) => i.uid)).toEqual(['instance-a', 'instance-b', 'prom']);
    });

    it('does not count a panel without any ref as a reference to the org default', async () => {
      const scene = buildScene({ panels: [buildPanel({ key: 'panel-1', queries: [{ refId: 'A' }] })] });

      expect((await collectDashboardQueryPolicyInputs(scene)).instances).toEqual([]);
    });

    it('gathers query, ad hoc, group-by and data source variables', async () => {
      // Group-by variables are only persisted (and therefore handed to the hook) behind this toggle.
      config.featureToggles.groupByVariable = true;
      const scene = buildScene({
        panels: [],
        variables: [
          new QueryVariable({ name: 'q', datasource: { type: 'loki', uid: 'loki' } }),
          new AdHocFiltersVariable({ name: 'filters', datasource: refB }),
          new GroupByVariable({ name: 'groupBy', datasource: promRef }),
          dsVariable(),
        ],
      });
      registerDataSource('loki', 'loki');

      try {
        const { instances } = await collectDashboardQueryPolicyInputs(scene);
        expect(instances.map((i) => i.uid)).toEqual(['instance-a', 'instance-b', 'loki', 'prom']);
      } finally {
        config.featureToggles.groupByVariable = false;
      }
    });

    it('hands the hook the dashboard variables and keeps the signature stable across query edits and reorders', async () => {
      const runner = new SceneQueryRunner({
        datasource: refA,
        queries: [
          { refId: 'A', expr: 'up' },
          { refId: 'B', expr: 'down' },
        ],
      });
      const panel = new VizPanel({ key: 'panel-1', pluginId: 'timeseries', $data: runner });
      const scene = buildScene({ panels: [panel], variables: [tenantVariable()] });

      const before = await collectDashboardQueryPolicyInputs(scene);
      expect(before.variables).toEqual([
        expect.objectContaining({
          name: 'tenant',
          type: 'constant',
          query: 'acme',
          current: expect.objectContaining({ value: 'acme' }),
        }),
      ]);

      runner.setState({
        queries: [
          { refId: 'A', expr: 'changed' },
          { refId: 'B', expr: 'down' },
        ],
      });
      expect((await collectDashboardQueryPolicyInputs(scene)).signature).toBe(before.signature);

      runner.setState({
        queries: [
          { refId: 'B', expr: 'down' },
          { refId: 'A', expr: 'changed' },
        ],
      });
      expect((await collectDashboardQueryPolicyInputs(scene)).signature).toBe(before.signature);

      runner.setState({ queries: [{ refId: 'A', datasource: refB }] });
      expect((await collectDashboardQueryPolicyInputs(scene)).signature).not.toBe(before.signature);
    });

    it("resolves each panel's refs in that panel's own scope", async () => {
      const panel = buildPanel({ key: 'panel-1', datasource: refVar });
      const scene = buildScene({ panels: [panel], variables: [dsVariable()] });

      await collectDashboardQueryPolicyInputs(scene);

      const call = mockGetInstanceSettings.mock.calls.find(([ref]) => uidOf(ref) === '$ds');
      expect(call).toBeDefined();
      expect(call![1]?.__sceneObject?.valueOf()).toBe(panel);
    });

    it('changes the signature with the dashboard UID and with ad hoc filters', async () => {
      const filters = new AdHocFiltersVariable({ name: 'filters', datasource: promRef, filters: [] });
      const scene = buildScene({ panels: [buildPanel({ key: 'panel-1', datasource: refA })], variables: [filters] });
      const initial = (await collectDashboardQueryPolicyInputs(scene)).signature;

      scene.setState({ uid: 'dash-2' });
      const withUid = (await collectDashboardQueryPolicyInputs(scene)).signature;
      expect(withUid).not.toBe(initial);

      filters.setState({ filters: [{ key: 'env', operator: '=', value: 'prod' }] });
      expect((await collectDashboardQueryPolicyInputs(scene)).signature).not.toBe(withUid);
    });

    it('omits interval variables from the hook context and the signature', async () => {
      const interval = new IntervalVariable({ name: 'interval', intervals: ['1m', '5m'], value: '1m' });
      const scene = buildScene({
        panels: [buildPanel({ key: 'panel-1', datasource: refA })],
        variables: [tenantVariable(), interval],
      });

      const before = await collectDashboardQueryPolicyInputs(scene);
      expect(before.variables.map((v) => v.type)).toEqual(['constant']);

      interval.setState({ value: '5m' });
      expect((await collectDashboardQueryPolicyInputs(scene)).signature).toBe(before.signature);
    });

    it('changes the signature when a variable value changes', async () => {
      const tenant = tenantVariable();
      const scene = buildScene({ panels: [buildPanel({ key: 'panel-1', datasource: refA })], variables: [tenant] });
      const before = (await collectDashboardQueryPolicyInputs(scene)).signature;

      tenant.setState({ value: 'globex' });

      expect((await collectDashboardQueryPolicyInputs(scene)).signature).not.toBe(before);
    });
  });

  describe('loadDashboardQueryPolicies', () => {
    it('returns undefined when no referenced data source implements the hook', async () => {
      const scene = buildScene({
        panels: [buildPanel({ key: 'panel-1', datasource: promRef })],
        variables: [tenantVariable()],
      });

      expect(await loadDashboardQueryPolicies(scene)).toBeUndefined();
    });

    it('keeps the policy of a claiming instance, hands it the dashboard UID and variables and records the other instances', async () => {
      const getDashboardQueryPolicy = claimWhenBound(policyA);
      registerDataSource('instance-a', RESTRICTED, getDashboardQueryPolicy);

      const scene = buildScene({
        panels: [buildPanel({ key: 'panel-1', datasource: refA }), buildPanel({ key: 'panel-2', datasource: promRef })],
        variables: [tenantVariable()],
      });

      expect(await loadDashboardQueryPolicies(scene)).toEqual(boundPolicies);
      expect(getDashboardQueryPolicy).toHaveBeenCalledWith({
        dashboardUID: 'dash-1',
        variables: [expect.objectContaining({ name: 'tenant', type: 'constant', query: 'acme' })],
      });
    });

    it('records that the org default is excluded when it is another instance of the claiming type', async () => {
      registerDataSource('instance-a', RESTRICTED, claimWhenBound(policyA));
      mockDefaultUid = 'instance-b';

      const scene = buildScene({
        panels: [buildPanel({ key: 'panel-1', datasource: refA })],
        variables: [tenantVariable()],
      });

      expect(await loadDashboardQueryPolicies(scene)).toEqual({
        [RESTRICTED]: { ...boundEntry, orgDefaultExcluded: true },
      });
    });

    it('keeps a policy whose instances cannot be listed and warns', async () => {
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
      registerDataSource('instance-a', RESTRICTED, claimWhenBound(policyA));
      mockListError = new Error('offline');

      const scene = buildScene({
        panels: [buildPanel({ key: 'panel-1', datasource: refA })],
        variables: [tenantVariable()],
      });

      expect(await loadDashboardQueryPolicies(scene)).toEqual({ [RESTRICTED]: { uid: 'instance-a', policy: policyA } });
      expect(warn).toHaveBeenCalledTimes(1);
      warn.mockRestore();
    });

    it('returns undefined when the only implementing instance declines', async () => {
      registerDataSource('instance-a', RESTRICTED, claimWhenBound(policyA));

      const scene = buildScene({ panels: [buildPanel({ key: 'panel-1', datasource: refA })] });

      expect(await loadDashboardQueryPolicies(scene)).toBeUndefined();
    });

    it('does not treat a concrete ref and a variable resolving to the same instance as a conflict', async () => {
      const getDashboardQueryPolicy = claimWhenBound(policyA);
      registerDataSource('instance-a', RESTRICTED, getDashboardQueryPolicy);

      const scene = buildScene({
        panels: [buildPanel({ key: 'panel-1', datasource: refA }), buildPanel({ key: 'panel-2', datasource: refVar })],
        variables: [tenantVariable(), dsVariable()],
      });

      expect(await loadDashboardQueryPolicies(scene)).toEqual(boundPolicies);
      expect(getDashboardQueryPolicy).toHaveBeenCalledTimes(1);
    });

    it('voids the policy for a type when two instances both claim the dashboard and warns naming both', async () => {
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
      registerDataSource('instance-a', RESTRICTED, claimWhenBound(policyA));
      registerDataSource('instance-b', RESTRICTED, claimWhenBound(policyB));

      const scene = buildScene({
        panels: [buildPanel({ key: 'panel-1', datasource: refA }), buildPanel({ key: 'panel-2', datasource: refB })],
        variables: [tenantVariable()],
      });

      expect(await loadDashboardQueryPolicies(scene)).toEqual({ [RESTRICTED]: undefined });
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls[0][0]).toContain('instance-a');
      expect(warn.mock.calls[0][0]).toContain('instance-b');
      warn.mockRestore();
    });

    it('skips data sources that fail to load and ignores a throwing hook with a warning', async () => {
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
      registerDataSource('instance-a', RESTRICTED, claimWhenBound(policyA));
      registerDataSource('prom', 'prometheus', async () => {
        throw new Error('boom');
      });

      const scene = buildScene({
        panels: [
          buildPanel({ key: 'panel-1', datasource: refA }),
          buildPanel({ key: 'panel-2', datasource: promRef }),
          buildPanel({ key: 'panel-3', datasource: { type: 'loki', uid: 'missing' } }),
        ],
        variables: [tenantVariable()],
      });

      expect(await loadDashboardQueryPolicies(scene)).toEqual(boundPolicies);
      expect(warn).toHaveBeenCalledTimes(1);
      warn.mockRestore();
    });
  });

  describe('with a policy on the dashboard', () => {
    let scene: DashboardScene;
    let ds: DataSourceVariable;

    beforeEach(() => {
      ds = dsVariable();
      scene = buildScene({ panels: [], variables: [ds] });
      scene.setState({ queryPolicies: boundPolicies });
    });

    describe('isDatasourceAllowed', () => {
      it('refuses other instances of the restricted type with the policy reason', () => {
        expect(isDatasourceAllowed(scene, refB)).toEqual({ allowed: false, reason: policyA.reason });
        expect(isDatasourceAllowed(scene, 'instance-b')).toEqual({ allowed: false, reason: policyA.reason });
      });

      it('allows the bound instance, other plugin types, built-ins and empty refs', () => {
        expect(isDatasourceAllowed(scene, refA)).toEqual({ allowed: true });
        expect(isDatasourceAllowed(scene, promRef)).toEqual({ allowed: true });
        expect(isDatasourceAllowed(scene, { type: 'datasource', uid: MIXED_DATASOURCE_NAME })).toEqual({
          allowed: true,
        });
        expect(isDatasourceAllowed(scene, { type: 'datasource', uid: SHARED_DASHBOARD_QUERY })).toEqual({
          allowed: true,
        });
        expect(isDatasourceAllowed(scene, undefined)).toEqual({ allowed: true });
        expect(isDatasourceAllowed(scene, null)).toEqual({ allowed: true });
      });

      it('judges a variable ref by the instance it currently resolves to', () => {
        expect(isDatasourceAllowed(scene, refVar)).toEqual({ allowed: true });

        ds.setState({ value: 'instance-b', text: 'instance-b' });
        expect(isDatasourceAllowed(scene, refVar).allowed).toBe(false);

        expect(isDatasourceAllowed(scene, { type: RESTRICTED, uid: '$missing' }).allowed).toBe(true);
      });

      it('judges an unresolvable concrete ref as written', () => {
        expect(isDatasourceAllowed(scene, { type: RESTRICTED, uid: 'instance-c' }).allowed).toBe(false);
        expect(isDatasourceAllowed(scene, { uid: 'unknown' }).allowed).toBe(true);
      });

      it('judges type-only and default refs by the defaults recorded at load time', () => {
        expect(isDatasourceAllowed(scene, { type: RESTRICTED }).allowed).toBe(true);
        expect(isDatasourceAllowed(scene, { uid: 'default' }).allowed).toBe(true);

        scene.setState({
          queryPolicies: { [RESTRICTED]: { ...boundEntry, defaultUid: 'instance-b', orgDefaultExcluded: true } },
        });
        expect(isDatasourceAllowed(scene, { type: RESTRICTED })).toEqual({ allowed: false, reason: policyA.reason });
        expect(isDatasourceAllowed(scene, { uid: 'default' })).toEqual({ allowed: false, reason: policyA.reason });
        expect(isDatasourceAllowed(scene, { type: 'prometheus' }).allowed).toBe(true);
      });

      it('falls back to the type a ref carries when the load recorded no instances', () => {
        scene.setState({ queryPolicies: { [RESTRICTED]: { uid: 'instance-a', policy: policyA } } });

        expect(isDatasourceAllowed(scene, refB).allowed).toBe(false);
        expect(isDatasourceAllowed(scene, 'instance-b').allowed).toBe(true);
        expect(isDatasourceAllowed(scene, { type: RESTRICTED }).allowed).toBe(true);
        expect(isDatasourceAllowed(scene, { uid: 'default' }).allowed).toBe(true);
      });

      it('allows everything when the dashboard has no policy', () => {
        scene.setState({ queryPolicies: undefined });
        expect(isDatasourceAllowed(scene, refB)).toEqual({ allowed: true });
      });
    });

    describe('isDatasourceAllowedFor', () => {
      it('checks through the scene object root and allows everything outside a dashboard', () => {
        const panel = buildPanel({ key: 'panel-1', datasource: refA });
        scene.state.body.addPanel(panel);

        expect(isDatasourceAllowedFor(panel, refB).allowed).toBe(false);
        expect(isDatasourceAllowedFor(new VizPanel({ key: 'loose' }), refB).allowed).toBe(true);
      });
    });

    describe('isVizPanelAllowed', () => {
      it('refuses a panel whose queries inherit an excluded panel-level ref', () => {
        const panel = buildPanel({ key: 'panel-1', datasource: refB, queries: [{ refId: 'A' }] });
        expect(isVizPanelAllowed(scene, panel)).toEqual({ allowed: false, reason: policyA.reason });
      });

      it('refuses a mixed panel with a query on an excluded instance', () => {
        const panel = buildPanel({
          key: 'panel-1',
          datasource: { type: 'datasource', uid: MIXED_DATASOURCE_NAME },
          queries: [
            { refId: 'A', datasource: promRef },
            { refId: 'B', datasource: refB },
          ],
        });
        expect(isVizPanelAllowed(scene, panel).allowed).toBe(false);
      });

      it('allows panels on the bound instance, through a variable, on other plugin types and without queries', () => {
        expect(isVizPanelAllowed(scene, buildPanel({ key: 'p1', datasource: refA })).allowed).toBe(true);
        expect(isVizPanelAllowed(scene, buildPanel({ key: 'p2', datasource: refVar })).allowed).toBe(true);
        expect(isVizPanelAllowed(scene, buildPanel({ key: 'p3', datasource: promRef })).allowed).toBe(true);
        expect(isVizPanelAllowed(scene, buildPanel({ key: 'p4', noData: true })).allowed).toBe(true);
        expect(isVizPanelAllowed(scene, buildPanel({ key: 'p5', queries: [{ refId: 'A' }] })).allowed).toBe(true);
      });
    });

    describe('areQueryChangesAllowed', () => {
      const previous = {
        datasource: refA,
        queries: [
          { refId: 'A', datasource: refA },
          { refId: 'B', datasource: refB },
        ],
      };

      it('leaves untouched queries alone, including one already on an excluded instance', () => {
        expect(areQueryChangesAllowed(scene, previous, previous).allowed).toBe(true);

        const edited: DataQuery = { ...previous.queries[1], queryType: 'edited' };
        expect(
          areQueryChangesAllowed(scene, previous, { datasource: refA, queries: [previous.queries[0], edited] }).allowed
        ).toBe(true);
      });

      it('refuses a new query on an excluded instance even when the panel already uses it', () => {
        expect(
          areQueryChangesAllowed(scene, previous, {
            datasource: refA,
            queries: [...previous.queries, { refId: 'C', datasource: refB }],
          })
        ).toEqual({ allowed: false, reason: policyA.reason });
      });

      it('refuses re-pointing a query to an excluded instance and allows re-pointing to the bound one', () => {
        expect(
          areQueryChangesAllowed(scene, previous, {
            datasource: refA,
            queries: [{ refId: 'A', datasource: refB }, previous.queries[1]],
          }).allowed
        ).toBe(false);
        expect(
          areQueryChangesAllowed(scene, previous, {
            datasource: refA,
            queries: [previous.queries[0], { refId: 'B', datasource: refA }],
          }).allowed
        ).toBe(true);
      });

      it('judges inherited refs through a changed panel-level ref and variables through their target', () => {
        const inherited = { datasource: refA, queries: [{ refId: 'A' }] };
        expect(areQueryChangesAllowed(scene, inherited, { datasource: refB, queries: [{ refId: 'A' }] }).allowed).toBe(
          false
        );
        expect(
          areQueryChangesAllowed(scene, inherited, {
            datasource: refA,
            queries: [{ refId: 'A' }, { refId: 'B', datasource: refVar }],
          }).allowed
        ).toBe(true);
      });

      it('allows everything without a policy', () => {
        scene.setState({ queryPolicies: undefined });
        expect(
          areQueryChangesAllowed(scene, previous, { datasource: refA, queries: [{ refId: 'C', datasource: refB }] })
            .allowed
        ).toBe(true);
      });
    });

    describe('isPanelModelAllowed', () => {
      it('checks the panel-level ref and the targets, which inherit it', () => {
        expect(isPanelModelAllowed(scene, { datasource: refB, targets: [{ refId: 'A' }] }).allowed).toBe(false);
        expect(
          isPanelModelAllowed(scene, { datasource: refA, targets: [{ refId: 'A', datasource: refB }] }).allowed
        ).toBe(false);
        expect(isPanelModelAllowed(scene, { datasource: refA, targets: [{ refId: 'A' }] }).allowed).toBe(true);
        expect(isPanelModelAllowed(scene, { targets: [{ refId: 'A' }] }).allowed).toBe(true);
      });
    });

    describe('datasourceFilterFor', () => {
      it('hides only other instances of the restricted type, judging variable entries by their target', () => {
        const filter = datasourceFilterFor(scene)!;

        expect(filter(mockSettings['instance-b'])).toBe(false);
        expect(filter(mockSettings['instance-a'])).toBe(true);
        expect(filter(mockSettings['prom'])).toBe(true);
        expect(filter(mockSettings['testdata'])).toBe(true);

        const variableEntry = (uid: string): DataSourceInstanceSettings => ({
          ...mockSettings[uid],
          uid: '$ds',
          name: '$ds',
          rawRef: { type: RESTRICTED, uid },
        });
        expect(filter(variableEntry('instance-a'))).toBe(true);
        expect(filter(variableEntry('instance-b'))).toBe(false);
      });

      it('is undefined without a policy or when every entry is void', () => {
        scene.setState({ queryPolicies: undefined });
        expect(datasourceFilterFor(scene)).toBeUndefined();

        scene.setState({ queryPolicies: { [RESTRICTED]: undefined } });
        expect(datasourceFilterFor(scene)).toBeUndefined();
      });
    });

    describe('defaultDatasourceFor and getNewPanelDatasourceFor', () => {
      it('returns the bound instance when the policy asks to default new panels to it', () => {
        expect(defaultDatasourceFor(scene)).toBe('instance-a');
        expect(getNewPanelDatasourceFor(scene)).toEqual(refA);
      });

      it('returns undefined when no policy asks for it or outside a dashboard', () => {
        scene.setState({ queryPolicies: { [RESTRICTED]: { uid: 'instance-b', policy: policyB } } });
        expect(defaultDatasourceFor(scene)).toBeUndefined();
        expect(getNewPanelDatasourceFor(scene)).toBeUndefined();
        expect(getNewPanelDatasourceFor(new VizPanel({ key: 'loose' }))).toBeUndefined();
      });

      it('falls back to the claiming instance when the org default is an excluded instance', () => {
        scene.setState({
          queryPolicies: { [RESTRICTED]: { uid: 'instance-a', policy: policyB, orgDefaultExcluded: true } },
        });
        expect(defaultDatasourceFor(scene)).toBeUndefined();
        expect(getNewPanelDatasourceFor(scene)).toEqual(refA);

        scene.setState({
          queryPolicies: { [RESTRICTED]: { uid: 'instance-a', policy: policyB, orgDefaultExcluded: false } },
        });
        expect(getNewPanelDatasourceFor(scene)).toBeUndefined();
      });

      it('picks the lowest plugin type id when several types ask for the default', () => {
        scene.setState({
          queryPolicies: {
            'z-datasource': { uid: 'z-1', policy: policyA },
            'b-datasource': { uid: 'b-1', policy: policyA },
          },
        });
        expect(defaultDatasourceFor(scene)).toBe('b-1');
        expect(getNewPanelDatasourceFor(scene)).toEqual({ type: 'b-datasource', uid: 'b-1' });
      });
    });
  });

  describe('useDashboardDatasourceFilter', () => {
    it('follows the dashboard policies without reacting to unrelated dashboard state', () => {
      const panel = buildPanel({ key: 'panel-1', datasource: refA });
      const scene = buildScene({ panels: [panel] });
      const { result } = renderHook(() => useDashboardDatasourceFilter(panel));

      expect(result.current).toBeUndefined();

      act(() => scene.setState({ queryPolicies: boundPolicies }));
      const filter = result.current!;
      expect(filter(mockSettings['instance-b'])).toBe(false);
      expect(filter(mockSettings['instance-a'])).toBe(true);

      act(() => scene.setState({ isDirty: true }));
      expect(result.current).toBe(filter);

      act(() => scene.setState({ queryPolicies: undefined }));
      expect(result.current).toBeUndefined();
    });

    it('is undefined outside a dashboard', () => {
      const { result } = renderHook(() => useDashboardDatasourceFilter(new VizPanel({ key: 'loose' })));
      expect(result.current).toBeUndefined();
    });
  });

  describe('notifyQueryPolicyRefusal', () => {
    it('publishes an error notification with the title and the policy reason', () => {
      notifyQueryPolicyRefusal('Title', policyA.reason);
      expect(mockPublish).toHaveBeenCalledWith({ type: AppEvents.alertError.name, payload: ['Title', policyA.reason] });
    });
  });
});
