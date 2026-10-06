import {
  type DataSourceApi,
  type DataSourceInstanceSettings,
  type DataSourcePluginMeta,
  type DrilldownMigrationUsage,
} from '@grafana/data';
import { getDataSourceInstance, getDataSourceInstanceSettings } from '@grafana/runtime/unstable';
import {
  QueryVariable,
  SceneDataTransformer,
  SceneGridLayout,
  SceneGridRow,
  SceneQueryRunner,
  SceneVariableSet,
  VizPanel,
  type SceneDataQuery,
} from '@grafana/scenes';
import { type DataSourceRef } from '@grafana/schema';

import { DashboardAnnotationsDataLayer } from '../scene/DashboardAnnotationsDataLayer';
import { DashboardDataLayerSet } from '../scene/DashboardDataLayerSet';
import { DashboardScene } from '../scene/DashboardScene';
import { VizPanelLinks, VizPanelLinksMenu } from '../scene/PanelLinks';
import { DashboardGridItem } from '../scene/layout-default/DashboardGridItem';
import { DefaultGridLayoutManager } from '../scene/layout-default/DefaultGridLayoutManager';

import { detectDrilldownMigrationCandidates } from './detect';

jest.mock('@grafana/runtime/unstable', () => ({
  ...jest.requireActual('@grafana/runtime/unstable'),
  getDataSourceInstance: jest.fn(),
  getDataSourceInstanceSettings: jest.fn(),
}));

const mockGetDataSourceInstance = jest.mocked(getDataSourceInstance);
const mockGetDataSourceInstanceSettings = jest.mocked(getDataSourceInstanceSettings);

// Mirrors the real lookup: a missing ref resolves to the default datasource.
const DEFAULT_DS_UID = 'default-ds';

const dsSettingsByUid: Record<string, DataSourceInstanceSettings> = {};
const dsInstanceByUid: Record<string, DataSourceApi> = {};

function getRefUid(ref?: DataSourceRef | string | null): string | undefined {
  if (!ref) {
    return DEFAULT_DS_UID;
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

function buildVariable(name: string, datasourceUid: string | undefined): QueryVariable {
  return new QueryVariable({
    name,
    datasource: datasourceUid ? { uid: datasourceUid } : undefined,
    query: `label_values(${name})`,
  });
}

function buildPanel(
  key: string,
  datasourceUid: string | undefined,
  queries: SceneDataQuery[],
  overrides: Partial<{ title: string }> = {}
): VizPanel {
  return new VizPanel({
    key,
    title: overrides.title ?? `Panel ${key}`,
    pluginId: 'timeseries',
    $data: new SceneQueryRunner({ datasource: datasourceUid ? { uid: datasourceUid } : undefined, queries }),
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

  it('disqualifies when the variable is a filter in one query and a groupBy label in another', async () => {
    const getUsage = jest.fn(({ query }: { query: SceneDataQuery }): DrilldownMigrationUsage | undefined =>
      query.refId === 'A' ? { kind: 'filter', key: 'instance', operator: '=' } : { kind: 'groupBy' }
    );
    registerDatasource('prom-a', 'prometheus', {
      getTagKeys: jest.fn(),
      getTagValues: jest.fn(),
      getGroupByKeys: jest.fn(),
      getDrilldownMigrationUsage: getUsage,
    });

    const variable = buildVariable('instance', 'prom-a');
    const panel1 = buildPanel('panel-1', 'prom-a', [{ refId: 'A', expr: 'up{instance="$instance"}' }]);
    const panel2 = buildPanel('panel-2', 'prom-a', [{ refId: 'B', expr: 'sum by ($instance) (up)' }]);
    const scene = buildScene([variable], [panel1, panel2]);

    expect(await detectDrilldownMigrationCandidates(scene)).toEqual([]);
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

  it('keeps a high-confidence filter candidate also referenced in a panel title, flagged for rewriting', async () => {
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

    expect(candidates).toEqual([
      expect.objectContaining({ variableName: 'instance', confidence: 'high', referencedOutsideQueries: true }),
    ]);
  });

  it('resolves a missing datasource ref on the variable and panel to the default datasource', async () => {
    registerDatasource(DEFAULT_DS_UID, 'prometheus', {
      getTagKeys: jest.fn(),
      getTagValues: jest.fn(),
      getDrilldownMigrationUsage: () => ({ kind: 'filter', key: 'instance', operator: '=~' }),
    });

    const variable = buildVariable('instance', undefined);
    const panel = buildPanel('panel-1', undefined, [{ refId: 'A', expr: 'up{instance=~"$instance"}' }]);
    const scene = buildScene([variable], [panel]);

    const candidates = await detectDrilldownMigrationCandidates(scene);

    expect(candidates).toEqual([
      {
        variableName: 'instance',
        datasourceUid: DEFAULT_DS_UID,
        confidence: 'high',
        usages: [{ kind: 'filter', key: 'instance', operator: '=~' }],
      },
    ]);
  });

  describe('references outside queries', () => {
    const safeQuery = { refId: 'A', expr: 'up{instance=~"$instance"}' };

    function buildSafePanel(overrides: Partial<VizPanel['state']> = {}): VizPanel {
      const panel = buildPanel('panel-1', 'prom-a', [safeQuery]);
      panel.setState(overrides);
      return panel;
    }

    beforeEach(() => {
      registerDatasource('prom-a', 'prometheus', {
        getTagKeys: jest.fn(),
        getTagValues: jest.fn(),
        getDrilldownMigrationUsage: () => ({ kind: 'filter', key: 'instance', operator: '=~' }),
      });
    });

    it('keeps the candidate when nothing outside queries references the variable', async () => {
      const scene = buildScene([buildVariable('instance', 'prom-a')], [buildSafePanel()]);

      expect(await detectDrilldownMigrationCandidates(scene)).toHaveLength(1);
    });

    const displayReferenceScenes: Array<[string, () => DashboardScene]> = [
      [
        'a field config data link',
        () =>
          buildScene(
            [buildVariable('instance', 'prom-a')],
            [
              buildSafePanel({
                fieldConfig: {
                  defaults: { links: [{ title: 'x', url: '/d/abc?var-instance=${instance}' }] },
                  overrides: [],
                },
              }),
            ]
          ),
      ],
      [
        'a field override',
        () =>
          buildScene(
            [buildVariable('instance', 'prom-a')],
            [
              buildSafePanel({
                fieldConfig: {
                  defaults: {},
                  overrides: [
                    {
                      matcher: { id: 'byName', options: 'up' },
                      properties: [{ id: 'displayName', value: '$instance' }],
                    },
                  ],
                },
              }),
            ]
          ),
      ],
      [
        'panel options',
        () =>
          buildScene(
            [buildVariable('instance', 'prom-a')],
            [buildSafePanel({ options: { content: 'Host $instance' } })]
          ),
      ],
      [
        'a panel link',
        () =>
          buildScene(
            [buildVariable('instance', 'prom-a')],
            [
              buildSafePanel({
                titleItems: [
                  new VizPanelLinks({
                    rawLinks: [{ title: 'x', url: '/explore?instance=$instance' }],
                    menu: new VizPanelLinksMenu({}),
                  }),
                ],
              }),
            ]
          ),
      ],
      [
        'a transformation',
        () => {
          const panel = buildSafePanel();
          panel.setState({
            $data: new SceneDataTransformer({
              $data: new SceneQueryRunner({ datasource: { uid: 'prom-a' }, queries: [safeQuery] }),
              transformations: [{ id: 'filterByValue', options: { value: '$instance' } }],
            }),
          });
          return buildScene([buildVariable('instance', 'prom-a')], [panel]);
        },
      ],
      [
        'a row title',
        () =>
          new DashboardScene({
            title: 'test dashboard',
            uid: 'dash-1',
            $variables: new SceneVariableSet({ variables: [buildVariable('instance', 'prom-a')] }),
            body: new DefaultGridLayoutManager({
              grid: new SceneGridLayout({
                children: [
                  new SceneGridRow({
                    title: 'Row $instance',
                    y: 0,
                    children: [new DashboardGridItem({ x: 0, y: 1, width: 12, height: 8, body: buildSafePanel() })],
                  }),
                ],
              }),
            }),
          }),
      ],
      [
        'a dashboard link',
        () => {
          const scene = buildScene([buildVariable('instance', 'prom-a')], [buildSafePanel()]);
          scene.setState({
            links: [
              {
                title: 'x',
                url: '/d/abc?var-instance=$instance',
                type: 'link',
                icon: '',
                tooltip: '',
                tags: [],
                asDropdown: false,
                targetBlank: false,
                includeVars: false,
                keepTime: false,
              },
            ],
          });
          return scene;
        },
      ],
    ];

    it.each(displayReferenceScenes)(
      'keeps a filter candidate referenced in %s, flagged for rewriting',
      async (_, buildTestScene) => {
        expect(await detectDrilldownMigrationCandidates(buildTestScene())).toEqual([
          expect.objectContaining({ variableName: 'instance', referencedOutsideQueries: true }),
        ]);
      }
    );

    it.each(displayReferenceScenes)('disqualifies a group-by candidate referenced in %s', async (_, buildTestScene) => {
      registerDatasource('prom-a', 'prometheus', {
        getGroupByKeys: jest.fn(),
        getDrilldownMigrationUsage: () => ({ kind: 'groupBy' }),
      });

      expect(await detectDrilldownMigrationCandidates(buildTestScene())).toEqual([]);
    });

    it.each(displayReferenceScenes)(
      'disqualifies a low-confidence candidate referenced in %s',
      async (_, buildTestScene) => {
        registerDatasource('prom-a', 'prometheus', { getTagKeys: jest.fn(), getTagValues: jest.fn() });

        expect(await detectDrilldownMigrationCandidates(buildTestScene())).toEqual([]);
      }
    );

    it('disqualifies a variable referenced in an annotation query', async () => {
      const buildTestScene = () => {
        const scene = buildScene([buildVariable('instance', 'prom-a')], [buildSafePanel()]);
        scene.setState({
          $data: new DashboardDataLayerSet({
            annotationLayers: [
              new DashboardAnnotationsDataLayer({
                name: 'Deploys',
                isEnabled: true,
                isHidden: false,
                query: {
                  name: 'Deploys',
                  enable: true,
                  iconColor: 'red',
                  datasource: { uid: 'prom-a' },
                  expr: 'deploys{instance="$instance"}',
                },
              }),
            ],
          }),
        });
        return scene;
      };

      expect(await detectDrilldownMigrationCandidates(buildTestScene())).toEqual([]);
    });
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
