import { of } from 'rxjs';

import { type DataSourceApi, type DataSourceRef, LoadingState } from '@grafana/data';
import { type DataSourceSrv, config, setDataSourceSrv, setRunRequest } from '@grafana/runtime';
import {
  type AdHocFiltersVariable,
  EmbeddedScene,
  SceneFlexItem,
  SceneFlexLayout,
  SceneQueryRunner,
  SceneTimeRange,
  SceneVariableSet,
} from '@grafana/scenes';

const DATASOURCE_UID = 'triage-prom-uid';

// ../constants reads the UID from config at module load, so this has to happen before the dynamic
// import of TriageScene below.
config.unifiedAlerting = {
  ...config.unifiedAlerting,
  stateHistory: { ...config.unifiedAlerting?.stateHistory, prometheusTargetDatasourceUID: DATASOURCE_UID },
};

const runRequest = jest.fn().mockReturnValue(of({ state: LoadingState.Done, series: [], timeRange: {} }));
const getDataSource = jest.fn(async (_ref?: DataSourceRef | string | null) => {
  const datasource: Partial<DataSourceApi> = {
    uid: DATASOURCE_UID,
    getRef: () => ({ uid: DATASOURCE_UID }),
    interval: '1m',
  };
  return datasource as DataSourceApi;
});

setRunRequest(runRequest);
setDataSourceSrv({
  get: getDataSource,
  getInstanceSettings: () => ({ uid: DATASOURCE_UID }),
} as unknown as DataSourceSrv);

/**
 * Runs a query against DATASOURCE_UID inside a scene carrying the given filters variable, and returns
 * the ad-hoc filters that ended up on the outgoing request.
 */
async function getRequestFiltersFor(variable: AdHocFiltersVariable) {
  const queryRunner = new SceneQueryRunner({
    datasource: { uid: DATASOURCE_UID },
    queries: [{ refId: 'query', expr: 'asserts:error:ratio{asserts_env="production"}' }],
  });

  const scene = new EmbeddedScene({
    $timeRange: new SceneTimeRange({ from: 'now-1h', to: 'now' }),
    $variables: new SceneVariableSet({ variables: [variable] }),
    body: new SceneFlexLayout({ children: [new SceneFlexItem({ body: queryRunner })] }),
  });

  scene.activate();
  queryRunner.activate();
  await new Promise((resolve) => setTimeout(resolve, 0));

  return runRequest.mock.calls.at(-1)?.[1]?.filters;
}

async function getTriageFiltersVariable() {
  const { triageScene } = await import('./TriageScene');
  // Clone so activating the test scene does not disturb the real (module-level) triage scene.
  const variable = triageScene.state.$variables?.getByName('filters')?.clone();
  return variable as AdHocFiltersVariable;
}

describe('triage filters variable', () => {
  beforeEach(() => {
    runRequest.mockClear();
    getDataSource.mockClear();
  });

  it('does not leak its filters into other queries in the scene', async () => {
    // Regression test: the triage page builds its own PromQL label matchers, but scenes merges every
    // ad-hoc filters variable it finds in a query runner's ancestry into DataQueryRequest.filters when
    // the datasource UIDs match, without honouring applyMode: 'manual'. Prometheus then appends those
    // matchers to the expression. That made the instance details drawer render "No data" for healthy
    // firing instances, since filters like alertname are not labels on the rule's own query.
    const variable = await getTriageFiltersVariable();
    variable.setState({ filters: [{ key: 'alertname', operator: '=', value: 'AuthErrorRatioBreach' }] });

    await expect(getRequestFiltersFor(variable)).resolves.toBeUndefined();
  });

  it('never resolves a datasource from its own (unset) ref', async () => {
    // The variable has no datasource ref, so anything resolving one from it would silently fall back to
    // the default datasource. The tag key/value providers pass the triage UID themselves instead.
    const variable = await getTriageFiltersVariable();
    await getRequestFiltersFor(variable);

    const resolvedRefs = getDataSource.mock.calls.map(([ref]) => ref);
    expect(resolvedRefs.length).toBeGreaterThan(0);
    expect(resolvedRefs).not.toContain(null);
    expect(resolvedRefs).not.toContain(undefined);
  });
});
