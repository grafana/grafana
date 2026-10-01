import {
  type DashboardQueryPolicy,
  type DashboardQueryPolicyContext,
  type DataSourceApi,
  type DataSourceInstanceSettings,
  type DataSourceRef,
} from '@grafana/data';
import {
  AdHocFiltersVariable,
  ConstantVariable,
  CustomVariable,
  GroupByVariable,
  IntervalVariable,
  SceneDataTransformer,
  sceneGraph,
  SceneGridLayout,
  SceneObjectStateChangedEvent,
  SceneQueryRunner,
  SceneTimeRange,
  type SceneVariable,
  SceneVariableSet,
  VizPanel,
} from '@grafana/scenes';
import { mockDataSource } from 'app/features/alerting/unified/mocks';

import { DashboardScene } from '../scene/DashboardScene';
import { DashboardGridItem } from '../scene/layout-default/DashboardGridItem';
import { DefaultGridLayoutManager } from '../scene/layout-default/DefaultGridLayoutManager';
import { isVizPanelAllowed } from '../utils/dashboardQueryPolicies';
import { getQueryRunnerFor } from '../utils/getQueryRunnerFor';

import { affectsQueryPolicies, DashboardQueryPoliciesBehavior } from './DashboardQueryPoliciesBehavior';

const RESTRICTED = 'restricted-datasource';

const mockDataSources: Record<string, DataSourceApi> = {};
const mockSettings: Record<string, DataSourceInstanceSettings> = {};

function uidOf(ref: DataSourceRef | string | null | undefined) {
  return typeof ref === 'string' ? ref : ref?.uid;
}

jest.mock('@grafana/runtime/unstable', () => ({
  ...jest.requireActual('@grafana/runtime/unstable'),
  getDataSourceInstance: (ref: DataSourceRef | string | null | undefined) => {
    const uid = uidOf(ref);
    const ds = uid ? mockDataSources[uid] : undefined;
    return ds ? Promise.resolve(ds) : Promise.reject(new Error(`Datasource ${uid} was not found`));
  },
  getDataSourceInstanceSettings: async (ref: DataSourceRef | string | null | undefined) => {
    const uid = uidOf(ref);
    if (uid === undefined || uid === null) {
      const type = typeof ref === 'object' ? ref?.type : undefined;
      return type ? Object.values(mockSettings).find((settings) => settings.type === type) : undefined;
    }
    return mockSettings[uid];
  },
  getDataSourceInstanceList: async ({ type }: { type?: string | string[] } = {}) =>
    Object.values(mockSettings)
      .filter((settings) => !type || settings.type === type)
      .map((settings) => ({ uid: settings.uid, name: settings.name, type: settings.type })),
}));

const policyA: DashboardQueryPolicy = {
  restrictSamePluginToThisInstance: true,
  defaultForNewPanels: true,
  reason: 'Dashboard is bound to instance A.',
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
}

/** Claims the dashboard only when a `tenant` constant is present; optionally answers after a delay. */
function claimWhenBound(policy: DashboardQueryPolicy, delayMs = 0) {
  return jest.fn(
    (context: DashboardQueryPolicyContext) =>
      new Promise<DashboardQueryPolicy | undefined>((resolve) => {
        const bound = context.variables.some((v) => v.type === 'constant' && v.name === 'tenant');
        setTimeout(() => resolve(bound ? policy : undefined), delayMs);
      })
  );
}

function buildPanel(key: string, datasource: DataSourceRef, queries = [{ refId: 'A', datasource }]): VizPanel {
  return new VizPanel({
    key,
    title: key,
    pluginId: 'timeseries',
    $data: new SceneDataTransformer({
      transformations: [],
      $data: new SceneQueryRunner({ datasource, queries }),
    }),
  });
}

/**
 * Builds a dashboard carrying the behavior. Tests activate the behavior alone: the dashboard's own
 * activation has unrelated side effects, and the behavior only reads state and listens to events.
 */
function buildScene(panels: VizPanel[], variables: SceneVariable[]) {
  const behavior = new DashboardQueryPoliciesBehavior();
  const scene = new DashboardScene({
    uid: 'dash-1',
    title: 'Bound dashboard',
    $timeRange: new SceneTimeRange({ from: 'now-6h', to: 'now' }),
    $variables: new SceneVariableSet({ variables }),
    $behaviors: [behavior],
    body: new DefaultGridLayoutManager({
      grid: new SceneGridLayout({
        children: panels.map((panel) => new DashboardGridItem({ key: `griditem-${panel.state.key}`, body: panel })),
      }),
    }),
  });

  return { scene, behavior };
}

const boundRef: DataSourceRef = { type: RESTRICTED, uid: 'instance-a' };
const promRef: DataSourceRef = { type: 'prometheus', uid: 'prom' };
const tenantVariable = () => new ConstantVariable({ name: 'tenant', value: 'acme' });
/** The entry a load produces for instance A: the only restricted instance registered, with no org default set. */
const boundPolicies = {
  [RESTRICTED]: {
    uid: 'instance-a',
    policy: policyA,
    excludedUids: [],
    defaultUid: 'instance-a',
    orgDefaultExcluded: false,
  },
};

/** Lets the debounce, the data source service and the hook promises settle. */
const settle = () => jest.advanceTimersByTimeAsync(300);

describe('DashboardQueryPoliciesBehavior', () => {
  let deactivate: (() => void) | undefined;
  let hook: jest.Mock;

  beforeEach(() => {
    jest.useFakeTimers();
    for (const key of Object.keys(mockDataSources)) {
      delete mockDataSources[key];
    }
    for (const key of Object.keys(mockSettings)) {
      delete mockSettings[key];
    }
    registerDataSource('prom', 'prometheus');
    hook = claimWhenBound(policyA);
    registerDataSource('instance-a', RESTRICTED, hook);
  });

  afterEach(() => {
    deactivate?.();
    deactivate = undefined;
    jest.useRealTimers();
  });

  it('computes the policies on activation', async () => {
    const { scene, behavior } = buildScene(
      [buildPanel('panel-1', boundRef), buildPanel('panel-2', promRef)],
      [tenantVariable()]
    );

    deactivate = behavior.activate();
    await settle();

    expect(scene.state.queryPolicies).toEqual(boundPolicies);
  });

  it('recomputes when the variable set changes', async () => {
    const tenant = tenantVariable();
    const { scene, behavior } = buildScene([buildPanel('panel-1', boundRef)], [tenant]);

    deactivate = behavior.activate();
    await settle();
    expect(scene.state.queryPolicies).toEqual(boundPolicies);

    sceneGraph.getVariables(scene).setState({ variables: [] });
    await settle();
    expect(scene.state.queryPolicies).toBeUndefined();

    sceneGraph.getVariables(scene).setState({ variables: [tenant] });
    await settle();
    expect(scene.state.queryPolicies).toEqual(boundPolicies);
  });

  it('clears the policy when the last restricting instance is removed from the dashboard', async () => {
    const boundPanel = buildPanel('panel-1', boundRef);
    const { scene, behavior } = buildScene([boundPanel, buildPanel('panel-2', promRef)], [tenantVariable()]);

    deactivate = behavior.activate();
    await settle();
    expect(scene.state.queryPolicies).toEqual(boundPolicies);

    const grid = (scene.state.body as DefaultGridLayoutManager).state.grid;
    grid.setState({ children: grid.state.children.filter((child) => child !== boundPanel.parent) });
    await settle();

    expect(scene.state.queryPolicies).toBeUndefined();
  });

  it('does nothing when no referenced data source implements the hook', async () => {
    const { scene, behavior } = buildScene([buildPanel('panel-1', promRef)], [tenantVariable()]);
    const setState = jest.spyOn(scene, 'setState');

    deactivate = behavior.activate();
    await settle();

    expect(scene.state.queryPolicies).toBeUndefined();
    expect(setState.mock.calls.some(([update]) => 'queryPolicies' in update)).toBe(false);
  });

  it('skips reloading when neither the referenced instances nor the variables changed', async () => {
    const panel = buildPanel('panel-1', boundRef, [
      { refId: 'A', datasource: boundRef },
      { refId: 'B', datasource: boundRef },
    ]);
    const { scene, behavior } = buildScene([panel], [tenantVariable()]);
    const runner = getQueryRunnerFor(panel)!;

    deactivate = behavior.activate();
    await settle();
    expect(hook).toHaveBeenCalledTimes(1);

    // Editing query text and reordering queries changes neither instances nor variables.
    runner.setState({
      queries: [
        { refId: 'A', datasource: boundRef, expr: 'changed' },
        { refId: 'B', datasource: boundRef },
      ],
    });
    await settle();
    runner.setState({
      queries: [
        { refId: 'B', datasource: boundRef },
        { refId: 'A', datasource: boundRef, expr: 'changed' },
      ],
    });
    await settle();
    expect(hook).toHaveBeenCalledTimes(1);

    // A new instance does.
    scene.state.body.addPanel(buildPanel('panel-2', promRef));
    await settle();
    expect(hook).toHaveBeenCalledTimes(2);
    expect(scene.state.queryPolicies).toEqual(boundPolicies);
  });

  it('does not hand interval variables to the hook and does not reload when they change', async () => {
    const interval = new IntervalVariable({ name: 'interval', intervals: ['1m', '5m'], value: '1m' });
    const { behavior } = buildScene([buildPanel('panel-1', boundRef)], [tenantVariable(), interval]);

    deactivate = behavior.activate();
    await settle();
    expect(hook).toHaveBeenCalledTimes(1);
    expect(hook.mock.calls[0][0].variables.map((v: { type: string }) => v.type)).toEqual(['constant']);

    interval.setState({ value: '5m' });
    await settle();
    expect(hook).toHaveBeenCalledTimes(1);
  });

  it('runs the hook again with the new filters when an ad hoc filter variable changes', async () => {
    const filters = new AdHocFiltersVariable({ name: 'filters', datasource: boundRef, filters: [] });
    const { behavior } = buildScene([buildPanel('panel-1', boundRef)], [tenantVariable(), filters]);

    deactivate = behavior.activate();
    await settle();
    expect(hook).toHaveBeenCalledTimes(1);

    filters.setState({ filters: [{ key: 'env', operator: '=', value: 'prod' }] });
    await settle();

    expect(hook).toHaveBeenCalledTimes(2);
    const context: DashboardQueryPolicyContext = hook.mock.calls[1][0];
    expect(context.variables).toContainEqual(
      expect.objectContaining({
        type: 'adhoc',
        name: 'filters',
        filters: [expect.objectContaining({ key: 'env', operator: '=', value: 'prod' })],
      })
    );
  });

  it('does not run the hook again for a variable change that leaves the serialised form unchanged', async () => {
    const tenant = tenantVariable();
    const { behavior } = buildScene([buildPanel('panel-1', boundRef)], [tenant]);

    deactivate = behavior.activate();
    await settle();
    expect(hook).toHaveBeenCalledTimes(1);

    tenant.setState({ loading: true });
    await settle();

    expect(hook).toHaveBeenCalledTimes(1);
  });

  it('recomputes when the dashboard uid changes', async () => {
    const { scene, behavior } = buildScene([buildPanel('panel-1', boundRef)], [tenantVariable()]);

    deactivate = behavior.activate();
    await settle();
    expect(hook).toHaveBeenCalledTimes(1);

    scene.setState({ uid: 'dash-2' });
    await settle();

    expect(hook).toHaveBeenCalledTimes(2);
    expect(hook.mock.calls[1][0].dashboardUID).toBe('dash-2');
  });

  it('exposes queryPoliciesLoading while a load is in flight', async () => {
    const slowHook = claimWhenBound(policyA, 1000);
    registerDataSource('instance-a', RESTRICTED, slowHook);
    const { scene, behavior } = buildScene([buildPanel('panel-1', boundRef)], [tenantVariable()]);

    expect(scene.state.queryPoliciesLoading).toBeUndefined();

    deactivate = behavior.activate();
    await jest.advanceTimersByTimeAsync(100);
    expect(scene.state.queryPoliciesLoading).toBe(true);
    expect(scene.state.queryPolicies).toBeUndefined();

    await jest.advanceTimersByTimeAsync(1500);
    expect(scene.state.queryPoliciesLoading).toBe(false);
    expect(scene.state.queryPolicies).toEqual(boundPolicies);
  });

  it('never publishes a stale load that finishes after the dashboard changed again', async () => {
    const slowHook = claimWhenBound(policyA, 1000);
    registerDataSource('instance-a', RESTRICTED, slowHook);
    const { scene, behavior } = buildScene([buildPanel('panel-1', boundRef)], [tenantVariable()]);

    deactivate = behavior.activate();
    await jest.advanceTimersByTimeAsync(100);
    expect(slowHook).toHaveBeenCalledTimes(1);

    // The dashboard is unbound while the first (binding) answer is still in flight.
    sceneGraph.getVariables(scene).setState({ variables: [] });
    await jest.advanceTimersByTimeAsync(2000);

    expect(slowHook).toHaveBeenCalledTimes(2);
    expect(scene.state.queryPolicies).toBeUndefined();
  });

  it('warns instead of rejecting when the inputs cannot be collected', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    // Group-by variables are not serialisable while their feature toggle is off.
    const { scene, behavior } = buildScene(
      [buildPanel('panel-1', boundRef)],
      [tenantVariable(), new GroupByVariable({ name: 'groupBy', datasource: boundRef })]
    );

    deactivate = behavior.activate();
    await settle();

    expect(scene.state.queryPolicies).toBeUndefined();
    expect(warn).toHaveBeenCalledWith('Failed to load dashboard query policies', expect.any(Error));
    warn.mockRestore();
  });

  it('keeps a duplicated panel on the bound instance allowed', async () => {
    const boundPanel = buildPanel('panel-1', boundRef);
    const { scene, behavior } = buildScene([boundPanel], [tenantVariable()]);

    deactivate = behavior.activate();
    await settle();
    expect(scene.state.queryPolicies).toEqual(boundPolicies);

    scene.duplicatePanel(boundPanel);

    const panels = scene.state.body.getVizPanels();
    expect(panels).toHaveLength(2);
    const duplicate = panels.find((panel) => panel !== boundPanel)!;
    expect(getQueryRunnerFor(duplicate)?.state.datasource).toEqual(boundRef);
    expect(isVizPanelAllowed(scene, duplicate)).toEqual({ allowed: true });
  });

  describe('affectsQueryPolicies', () => {
    const interval = new IntervalVariable({ name: 'interval', intervals: ['1m'], value: '1m' });
    const { scene } = buildScene(
      [buildPanel('panel-1', boundRef)],
      [new CustomVariable({ name: 'env', query: 'a,b' }), interval]
    );
    const panel = scene.state.body.getVizPanels()[0];
    const queryRunner = getQueryRunnerFor(panel)!;
    const variable = sceneGraph.getVariables(scene).state.variables[0];

    const event = (
      changedObject: Parameters<typeof affectsQueryPolicies>[1]['payload']['changedObject'],
      partialUpdate: object
    ) =>
      new SceneObjectStateChangedEvent({
        changedObject,
        prevState: changedObject.state,
        newState: changedObject.state,
        partialUpdate,
      });

    it.each([
      ['dashboard body', scene, { body: scene.state.body }, true],
      ['dashboard uid', scene, { uid: 'dash-2' }, true],
      ['dashboard isDirty', scene, { isDirty: true }, false],
      ['variable set variables', sceneGraph.getVariables(scene), { variables: [] }, true],
      ['variable value', variable, { value: 'b', text: 'b' }, true],
      ['variable options', variable, { options: [], loading: false }, true],
      ['interval variable value', interval, { value: '5m' }, true],
      ['query runner datasource', queryRunner, { datasource: promRef }, true],
      ['query runner queries', queryRunner, { queries: [] }, true],
      ['query runner data', queryRunner, { data: undefined }, false],
      ['panel $data', panel, { $data: undefined }, true],
      ['panel render counter', panel, { _renderCounter: 2 }, false],
      ['grid children', (scene.state.body as DefaultGridLayoutManager).state.grid, { children: [] }, true],
      ['grid item position', panel.parent!, { x: 1, y: 2 }, false],
    ])('%s -> %s', (_name, changedObject, partialUpdate, expected) => {
      expect(affectsQueryPolicies(scene, event(changedObject, partialUpdate))).toBe(expected);
    });
  });
});
