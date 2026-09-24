import {
  type DataSourceApi,
  type DataSourceInstanceSettings,
  type DataSourcePluginMeta,
  type DrilldownMigrationUsage,
} from '@grafana/data';
import { getDataSourceInstance, getDataSourceInstanceSettings } from '@grafana/runtime/unstable';
import { QueryVariable, SceneQueryRunner, SceneVariableSet, VizPanel, type SceneDataQuery } from '@grafana/scenes';
import { type DataSourceRef } from '@grafana/schema';

import { DashboardScene } from '../scene/DashboardScene';
import { DefaultGridLayoutManager } from '../scene/layout-default/DefaultGridLayoutManager';

import { detectDrilldownMigrationCandidates } from './detect';

jest.mock('@grafana/runtime/unstable', () => ({
  ...jest.requireActual('@grafana/runtime/unstable'),
  getDataSourceInstance: jest.fn(),
  getDataSourceInstanceSettings: jest.fn(),
}));

const mockGetDataSourceInstance = jest.mocked(getDataSourceInstance);
const mockGetDataSourceInstanceSettings = jest.mocked(getDataSourceInstanceSettings);

const dsSettingsByUid: Record<string, DataSourceInstanceSettings> = {};
const dsInstanceByUid: Record<string, DataSourceApi> = {};

function getRefUid(ref?: DataSourceRef | string | null): string | undefined {
  if (!ref) {
    return undefined;
  }
  return typeof ref === 'string' ? ref : ref.uid;
}

function registerDatasource(uid: string, type: string, ds: Partial<DataSourceApi>) {
  const settings = {
    uid,
    type,
    name: uid,
    meta: {} as DataSourcePluginMeta,
    readOnly: false,
    jsonData: {},
    access: 'proxy',
  } as DataSourceInstanceSettings;

  dsSettingsByUid[uid] = settings;
  dsInstanceByUid[uid] = ds as unknown as DataSourceApi;
}

function buildVariable(name: string, datasourceUid: string): QueryVariable {
  return new QueryVariable({ name, datasource: { uid: datasourceUid }, query: `label_values(${name})` });
}

function buildPanel(
  key: string,
  datasourceUid: string,
  queries: SceneDataQuery[],
  overrides: Partial<{ title: string }> = {}
): VizPanel {
  return new VizPanel({
    key,
    title: overrides.title ?? `Panel ${key}`,
    pluginId: 'timeseries',
    $data: new SceneQueryRunner({ datasource: { uid: datasourceUid }, queries }),
    options: {},
    fieldConfig: { defaults: {}, overrides: [] },
  });
}

function buildScene(variables: QueryVariable[], panels: VizPanel[]): DashboardScene {
  return new DashboardScene({
    title: 'test dashboard',
    uid: 'dash-1',
    $variables: new SceneVariableSet({ variables }),
    body: DefaultGridLayoutManager.fromVizPanels(panels),
  });
}

beforeEach(() => {
  for (const key of Object.keys(dsSettingsByUid)) {
    delete dsSettingsByUid[key];
  }
  for (const key of Object.keys(dsInstanceByUid)) {
    delete dsInstanceByUid[key];
  }

  mockGetDataSourceInstanceSettings.mockImplementation(async (ref) => {
    const uid = getRefUid(ref);
    return uid ? dsSettingsByUid[uid] : undefined;
  });

  mockGetDataSourceInstance.mockImplementation(async (ref) => {
    const uid = getRefUid(ref);
    const ds = uid ? dsInstanceByUid[uid] : undefined;
    if (!ds) {
      throw new Error(`no datasource registered for ${JSON.stringify(ref)}`);
    }
    return ds;
  });
});

afterEach(() => {
  jest.clearAllMocks();
});

describe('detectDrilldownMigrationCandidates', () => {
  it('does not produce a candidate when the datasource has no filter/groupBy capability', async () => {
    registerDatasource('prom-a', 'prometheus', {});

    const variable = buildVariable('instance', 'prom-a');
    const panel = buildPanel('panel-1', 'prom-a', [{ refId: 'A', expr: 'up{instance=~"$instance"}' }]);
    const scene = buildScene([variable], [panel]);

    const candidates = await detectDrilldownMigrationCandidates(scene);

    expect(candidates).toEqual([]);
  });

  it('aggregates a high-confidence filter candidate when usages agree on one key', async () => {
    const getUsage = jest.fn(({ query }: { query: SceneDataQuery }): DrilldownMigrationUsage | undefined =>
      query.refId === 'A' || query.refId === 'B' ? { kind: 'filter', key: 'instance', operator: '=~' } : undefined
    );
    registerDatasource('prom-a', 'prometheus', {
      getTagKeys: jest.fn(),
      getTagValues: jest.fn(),
      getDrilldownMigrationUsage: getUsage,
    });

    const variable = buildVariable('instance', 'prom-a');
    const panel1 = buildPanel('panel-1', 'prom-a', [{ refId: 'A', expr: 'up{instance=~"$instance"}' }]);
    const panel2 = buildPanel('panel-2', 'prom-a', [{ refId: 'B', expr: 'up{instance=~"$instance"}' }]);
    const scene = buildScene([variable], [panel1, panel2]);

    const candidates = await detectDrilldownMigrationCandidates(scene);

    expect(candidates).toEqual([
      {
        variableName: 'instance',
        datasourceUid: 'prom-a',
        confidence: 'high',
        usages: [
          { kind: 'filter', key: 'instance', operator: '=~' },
          { kind: 'filter', key: 'instance', operator: '=~' },
        ],
      },
    ]);
  });

  it('produces a high-confidence groupBy candidate', async () => {
    const getUsage = jest.fn(({ query }: { query: SceneDataQuery }): DrilldownMigrationUsage | undefined =>
      query.refId === 'A' ? { kind: 'groupBy' } : undefined
    );
    registerDatasource('prom-a', 'prometheus', {
      getTagKeys: jest.fn(),
      getTagValues: jest.fn(),
      getDrilldownMigrationUsage: getUsage,
    });

    const variable = buildVariable('group_by', 'prom-a');
    const panel = buildPanel('panel-1', 'prom-a', [{ refId: 'A', expr: 'sum by($group_by) (up)' }]);
    const scene = buildScene([variable], [panel]);

    const candidates = await detectDrilldownMigrationCandidates(scene);

    expect(candidates).toEqual([
      {
        variableName: 'group_by',
        datasourceUid: 'prom-a',
        confidence: 'high',
        usages: [{ kind: 'groupBy' }],
      },
    ]);
  });

  it('disqualifies when filter keys disagree across usages', async () => {
    const getUsage = jest.fn(({ query }: { query: SceneDataQuery }): DrilldownMigrationUsage | undefined => {
      if (query.refId === 'A') {
        return { kind: 'filter', key: 'instance', operator: '=~' };
      }
      if (query.refId === 'B') {
        return { kind: 'filter', key: 'host', operator: '=~' };
      }
      return undefined;
    });
    registerDatasource('prom-a', 'prometheus', {
      getTagKeys: jest.fn(),
      getTagValues: jest.fn(),
      getDrilldownMigrationUsage: getUsage,
    });

    const variable = buildVariable('instance', 'prom-a');
    const panel1 = buildPanel('panel-1', 'prom-a', [{ refId: 'A', expr: 'up{instance=~"$instance"}' }]);
    const panel2 = buildPanel('panel-2', 'prom-a', [{ refId: 'B', expr: 'up{host=~"$instance"}' }]);
    const scene = buildScene([variable], [panel1, panel2]);

    const candidates = await detectDrilldownMigrationCandidates(scene);

    expect(candidates).toEqual([]);
  });

  it('disqualifies when the datasource reports a usage as unsafe', async () => {
    const getUsage = jest.fn((): DrilldownMigrationUsage | undefined => ({
      kind: 'unsafe',
      reason: 'used as a metric name',
    }));
    registerDatasource('prom-a', 'prometheus', {
      getTagKeys: jest.fn(),
      getTagValues: jest.fn(),
      getDrilldownMigrationUsage: getUsage,
    });

    const variable = buildVariable('metric', 'prom-a');
    const panel = buildPanel('panel-1', 'prom-a', [{ refId: 'A', expr: '$metric{}' }]);
    const scene = buildScene([variable], [panel]);

    const candidates = await detectDrilldownMigrationCandidates(scene);

    expect(candidates).toEqual([]);
  });

  it('disqualifies when the variable is also referenced in a query on a different datasource', async () => {
    const getUsage = jest.fn(({ query }: { query: SceneDataQuery }): DrilldownMigrationUsage | undefined =>
      query.refId === 'A' ? { kind: 'filter', key: 'instance', operator: '=~' } : undefined
    );
    registerDatasource('prom-a', 'prometheus', {
      getTagKeys: jest.fn(),
      getTagValues: jest.fn(),
      getDrilldownMigrationUsage: getUsage,
    });
    registerDatasource('graphite-a', 'graphite', {});

    const variable = buildVariable('instance', 'prom-a');
    const panel1 = buildPanel('panel-1', 'prom-a', [{ refId: 'A', expr: 'up{instance=~"$instance"}' }]);
    const panel2 = buildPanel('panel-2', 'graphite-a', [{ refId: 'B', target: 'aliasByNode($instance, 1)' }]);
    const scene = buildScene([variable], [panel1, panel2]);

    const candidates = await detectDrilldownMigrationCandidates(scene);

    expect(candidates).toEqual([]);
  });

  it('falls back to a low-confidence candidate when the datasource lacks getDrilldownMigrationUsage but supports filters', async () => {
    registerDatasource('prom-a', 'prometheus', {
      getTagKeys: jest.fn(),
      getTagValues: jest.fn(),
    });

    const variable = buildVariable('instance', 'prom-a');
    const panel = buildPanel('panel-1', 'prom-a', [{ refId: 'A', expr: 'up{instance=~"$instance"}' }]);
    const scene = buildScene([variable], [panel]);

    const candidates = await detectDrilldownMigrationCandidates(scene);

    expect(candidates).toEqual([{ variableName: 'instance', datasourceUid: 'prom-a', confidence: 'low', usages: [] }]);
  });

  it('does not produce a low-confidence candidate when the variable never textually appears in a query', async () => {
    registerDatasource('prom-a', 'prometheus', {
      getTagKeys: jest.fn(),
      getTagValues: jest.fn(),
    });

    const variable = buildVariable('instance', 'prom-a');
    const panel = buildPanel('panel-1', 'prom-a', [{ refId: 'A', expr: 'up' }], { title: 'Instance: $instance' });
    const scene = buildScene([variable], [panel]);

    const candidates = await detectDrilldownMigrationCandidates(scene);

    expect(candidates).toEqual([]);
  });

  it('disqualifies a high-confidence candidate when the variable is also referenced in a panel title', async () => {
    const getUsage = jest.fn(({ query }: { query: SceneDataQuery }): DrilldownMigrationUsage | undefined =>
      query.refId === 'A' ? { kind: 'filter', key: 'instance', operator: '=~' } : undefined
    );
    registerDatasource('prom-a', 'prometheus', {
      getTagKeys: jest.fn(),
      getTagValues: jest.fn(),
      getDrilldownMigrationUsage: getUsage,
    });

    const variable = buildVariable('instance', 'prom-a');
    const panel1 = buildPanel('panel-1', 'prom-a', [{ refId: 'A', expr: 'up{instance=~"$instance"}' }]);
    const panel2 = buildPanel('panel-2', 'prom-a', [{ refId: 'B', expr: 'up' }], { title: 'Instance: $instance' });
    const scene = buildScene([variable], [panel1, panel2]);

    const candidates = await detectDrilldownMigrationCandidates(scene);

    expect(candidates).toEqual([]);
  });

  it('skips a variable whose own datasource ref is itself variable-templated', async () => {
    registerDatasource('prom-a', 'prometheus', {
      getTagKeys: jest.fn(),
      getTagValues: jest.fn(),
    });

    const variable = new QueryVariable({
      name: 'instance',
      datasource: { uid: '${ds}' },
      query: 'label_values(instance)',
    });
    const panel = buildPanel('panel-1', 'prom-a', [{ refId: 'A', expr: 'up{instance=~"$instance"}' }]);
    const scene = buildScene([variable], [panel]);

    const candidates = await detectDrilldownMigrationCandidates(scene);

    expect(candidates).toEqual([]);
    expect(mockGetDataSourceInstanceSettings).not.toHaveBeenCalledWith({ uid: '${ds}' });
  });
});
