import { of } from 'rxjs';

import { DataQueryRequest, DataSourceApi, DrilldownsApplicability, LoadingState } from '@grafana/data';
import { getPanelPlugin } from '@grafana/data/test';
import { setPluginImportUtils } from '@grafana/runtime';
import {
  AdHocFiltersVariable,
  SceneQueryRunner,
  SceneVariableSet,
  VizPanel,
} from '@grafana/scenes';

import { activateFullSceneTree } from '../utils/test-utils';

import { ApplicabilityManager } from './ApplicabilityManager';
import { DashboardScene } from './DashboardScene';
import { DefaultGridLayoutManager } from './layout-default/DefaultGridLayoutManager';

const runRequestMock = jest.fn().mockImplementation((_ds: DataSourceApi, request: DataQueryRequest) => {
  return of({
    state: LoadingState.Loading,
    series: [],
    timeRange: request.range,
  });
});

const mockApplicabilityPanelQueries: DrilldownsApplicability[] = [
  { key: 'env', applicable: true },
  { key: 'instance', applicable: false, reason: 'not in result' },
];
const mockApplicabilityQueries: DrilldownsApplicability[] = [
  { key: 'env', applicable: true },
  { key: 'job', applicable: true },
];

const getDrilldownsApplicabilityMock = jest.fn();

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getRunRequest: () => (ds: DataSourceApi, request: DataQueryRequest) => {
    return runRequestMock(ds, request);
  },
  getDataSourceSrv: () => ({
    get: jest.fn().mockImplementation(async (ref: { uid: string }) => ({
      uid: ref.uid,
      getRef: () => ({ uid: ref.uid, type: 'test' }),
      getDrilldownsApplicability: getDrilldownsApplicabilityMock,
    })),
    getInstanceSettings: jest.fn().mockResolvedValue({ uid: 'ds-1', type: 'test' }),
  }),
}));

// Mock findClosestAdHocFilterInHierarchy - the scenes dist may not export it in test env
jest.mock('@grafana/scenes', () => {
  const actual = jest.requireActual('@grafana/scenes');
  const { AdHocFiltersVariable: AdHocVar } = actual;
  const findClosestAdHocFilterInHierarchy = (dsUid: string | undefined, sceneObject: any) => {
    let current: any = sceneObject;
    while (current) {
      const variables = current.state?.$variables?.state?.variables ?? [];
      for (const variable of variables) {
        if (variable instanceof AdHocVar) {
          const varDsUid = variable.state?.datasource?.uid;
          if (varDsUid === dsUid) {
            return variable;
          }
        }
      }
      current = current.parent;
    }
    return undefined;
  };
  return {
    ...actual,
    findClosestAdHocFilterInHierarchy,
  };
});

setPluginImportUtils({
  importPanelPlugin: () => Promise.resolve(getPanelPlugin({})),
  getPanelPluginFromCache: () => undefined,
});

describe('ApplicabilityManager', () => {
  beforeEach(() => {
    getDrilldownsApplicabilityMock.mockReset();
  });

  describe('buildGroups / resolveAll', () => {
    it('groups panels sharing same adhoc var and DS, making one getDrilldownsApplicability call', async () => {
      const adhocVar = new AdHocFiltersVariable({
        name: 'adhoc',
        label: 'adhoc',
        filters: [{ key: 'env', operator: '=', value: 'prod' }],
        datasource: { uid: 'ds-1' },
        applicabilityEnabled: true,
      });

      const panel1 = new VizPanel({
        key: 'panel-1',
        title: 'Panel 1',
        pluginId: 'timeseries',
        $data: new SceneQueryRunner({
          datasource: { uid: 'ds-1' },
          queries: [{ refId: 'A', datasource: { uid: 'ds-1' } }],
        }),
      });

      const panel2 = new VizPanel({
        key: 'panel-2',
        title: 'Panel 2',
        pluginId: 'timeseries',
        $data: new SceneQueryRunner({
          datasource: { uid: 'ds-1' },
          queries: [{ refId: 'A', datasource: { uid: 'ds-1' } }],
        }),
      });

      getDrilldownsApplicabilityMock.mockResolvedValue(
        new Map([
          ['panel-1', mockApplicabilityPanelQueries],
          ['panel-2', mockApplicabilityPanelQueries],
        ])
      );

      const applicabilityManager = new ApplicabilityManager();
      const scene = new DashboardScene({
        $variables: new SceneVariableSet({ variables: [adhocVar] }),
        $behaviors: [applicabilityManager],
        body: DefaultGridLayoutManager.fromVizPanels([panel1, panel2]),
      });

      activateFullSceneTree(scene);
      await new Promise((r) => setTimeout(r, 1));

      expect(getDrilldownsApplicabilityMock).toHaveBeenCalledTimes(1);
      expect(getDrilldownsApplicabilityMock).toHaveBeenCalledWith(
        expect.objectContaining({
          filters: expect.any(Array),
          panelQueries: expect.any(Map),
          timeRange: expect.any(Object),
        })
      );
    });

    it('creates different groups for panels using different DS UIDs', async () => {
      const adhocVar1 = new AdHocFiltersVariable({
        name: 'adhoc1',
        label: 'adhoc1',
        filters: [{ key: 'env', operator: '=', value: 'prod' }],
        datasource: { uid: 'ds-1' },
        applicabilityEnabled: true,
      });

      const adhocVar2 = new AdHocFiltersVariable({
        name: 'adhoc2',
        label: 'adhoc2',
        filters: [{ key: 'job', operator: '=', value: 'api' }],
        datasource: { uid: 'ds-2' },
        applicabilityEnabled: true,
      });

      const panel1 = new VizPanel({
        key: 'panel-1',
        title: 'Panel 1',
        pluginId: 'timeseries',
        $data: new SceneQueryRunner({
          datasource: { uid: 'ds-1' },
          queries: [{ refId: 'A', datasource: { uid: 'ds-1' } }],
        }),
      });

      const panel2 = new VizPanel({
        key: 'panel-2',
        title: 'Panel 2',
        pluginId: 'timeseries',
        $data: new SceneQueryRunner({
          datasource: { uid: 'ds-2' },
          queries: [{ refId: 'A', datasource: { uid: 'ds-2' } }],
        }),
      });

      getDrilldownsApplicabilityMock.mockResolvedValue(
        new Map([
          ['panel-1', mockApplicabilityPanelQueries],
          ['panel-2', mockApplicabilityPanelQueries],
        ])
      );

      const applicabilityManager = new ApplicabilityManager();
      const scene = new DashboardScene({
        $variables: new SceneVariableSet({ variables: [adhocVar1, adhocVar2] }),
        $behaviors: [applicabilityManager],
        body: DefaultGridLayoutManager.fromVizPanels([panel1, panel2]),
      });

      activateFullSceneTree(scene);
      await new Promise((r) => setTimeout(r, 1));

      expect(getDrilldownsApplicabilityMock).toHaveBeenCalledTimes(2);
    });
  });

  describe('getApplicabilityForPanel', () => {
    it('returns the correct DrilldownsApplicability for a given panel key', async () => {
      const adhocVar = new AdHocFiltersVariable({
        name: 'adhoc',
        label: 'adhoc',
        filters: [{ key: 'env', operator: '=', value: 'prod' }],
        datasource: { uid: 'ds-1' },
        applicabilityEnabled: true,
      });

      const panel1 = new VizPanel({
        key: 'panel-1',
        title: 'Panel 1',
        pluginId: 'timeseries',
        $data: new SceneQueryRunner({
          datasource: { uid: 'ds-1' },
          queries: [{ refId: 'A', datasource: { uid: 'ds-1' } }],
        }),
      });

      const panel1Result = [{ key: 'panel1-env', applicable: true }];
      getDrilldownsApplicabilityMock.mockResolvedValue(
        new Map([['panel-1', panel1Result]])
      );

      const applicabilityManager = new ApplicabilityManager();
      const scene = new DashboardScene({
        $variables: new SceneVariableSet({ variables: [adhocVar] }),
        $behaviors: [applicabilityManager],
        body: DefaultGridLayoutManager.fromVizPanels([panel1]),
      });

      activateFullSceneTree(scene);
      await new Promise((r) => setTimeout(r, 1));

      expect(applicabilityManager.getApplicabilityForPanel('panel-1')).toEqual(panel1Result);
    });

    it('returns undefined for unknown panel key', async () => {
      const adhocVar = new AdHocFiltersVariable({
        name: 'adhoc',
        label: 'adhoc',
        filters: [{ key: 'env', operator: '=', value: 'prod' }],
        datasource: { uid: 'ds-1' },
        applicabilityEnabled: true,
      });

      const panel1 = new VizPanel({
        key: 'panel-1',
        title: 'Panel 1',
        pluginId: 'timeseries',
        $data: new SceneQueryRunner({
          datasource: { uid: 'ds-1' },
          queries: [{ refId: 'A', datasource: { uid: 'ds-1' } }],
        }),
      });

      getDrilldownsApplicabilityMock.mockResolvedValue(
        new Map([['panel-1', mockApplicabilityPanelQueries]])
      );

      const applicabilityManager = new ApplicabilityManager();
      const scene = new DashboardScene({
        $variables: new SceneVariableSet({ variables: [adhocVar] }),
        $behaviors: [applicabilityManager],
        body: DefaultGridLayoutManager.fromVizPanels([panel1]),
      });

      activateFullSceneTree(scene);
      await new Promise((r) => setTimeout(r, 1));

      expect(applicabilityManager.getApplicabilityForPanel('unknown-panel')).toBeUndefined();
    });
  });

  describe('refreshForPanel', () => {
    it('calls getDrilldownsApplicability with queries (not panelQueries)', async () => {
      const adhocVar = new AdHocFiltersVariable({
        name: 'adhoc',
        label: 'adhoc',
        filters: [{ key: 'env', operator: '=', value: 'prod' }],
        datasource: { uid: 'ds-1' },
        applicabilityEnabled: true,
      });

      const customQueries = [
        { refId: 'A', datasource: { uid: 'ds-1' } },
        { refId: 'B', datasource: { uid: 'ds-1' } },
      ];

      const panel1 = new VizPanel({
        key: 'panel-1',
        title: 'Panel 1',
        pluginId: 'timeseries',
        $data: new SceneQueryRunner({
          datasource: { uid: 'ds-1' },
          queries: customQueries,
        }),
      });

      getDrilldownsApplicabilityMock.mockResolvedValue(
        new Map([['_default_', mockApplicabilityQueries]])
      );

      const applicabilityManager = new ApplicabilityManager();
      const scene = new DashboardScene({
        $variables: new SceneVariableSet({ variables: [adhocVar] }),
        $behaviors: [applicabilityManager],
        body: DefaultGridLayoutManager.fromVizPanels([panel1]),
      });

      activateFullSceneTree(scene);
      await new Promise((r) => setTimeout(r, 1));

      getDrilldownsApplicabilityMock.mockClear();

      await applicabilityManager.refreshForPanel('panel-1', customQueries);

      expect(getDrilldownsApplicabilityMock).toHaveBeenCalledTimes(1);
      const call = getDrilldownsApplicabilityMock.mock.calls[0][0];
      expect(call.queries).toEqual(customQueries);
      expect(call.panelQueries).toBeUndefined();
    });

    it('maps _default_ key result to the actual panel key and updates state', async () => {
      const adhocVar = new AdHocFiltersVariable({
        name: 'adhoc',
        label: 'adhoc',
        filters: [{ key: 'env', operator: '=', value: 'prod' }],
        datasource: { uid: 'ds-1' },
        applicabilityEnabled: true,
      });

      const customQueries = [{ refId: 'A', datasource: { uid: 'ds-1' } }];
      const refreshResult = [{ key: 'refreshed', applicable: true }];

      const panel1 = new VizPanel({
        key: 'panel-1',
        title: 'Panel 1',
        pluginId: 'timeseries',
        $data: new SceneQueryRunner({
          datasource: { uid: 'ds-1' },
          queries: customQueries,
        }),
      });

      getDrilldownsApplicabilityMock.mockResolvedValue(
        new Map([['panel-1', mockApplicabilityPanelQueries]])
      );

      const applicabilityManager = new ApplicabilityManager();
      const scene = new DashboardScene({
        $variables: new SceneVariableSet({ variables: [adhocVar] }),
        $behaviors: [applicabilityManager],
        body: DefaultGridLayoutManager.fromVizPanels([panel1]),
      });

      activateFullSceneTree(scene);
      await new Promise((r) => setTimeout(r, 1));

      getDrilldownsApplicabilityMock.mockResolvedValue(
        new Map([['_default_', refreshResult]])
      );

      await applicabilityManager.refreshForPanel('panel-1', customQueries);

      expect(applicabilityManager.getApplicabilityForPanel('panel-1')).toEqual(refreshResult);
    });
  });

  describe('re-resolution on adhoc changes', () => {
    it('calls resolveAll again when adhoc var filters change', async () => {
      const adhocVar = new AdHocFiltersVariable({
        name: 'adhoc',
        label: 'adhoc',
        filters: [{ key: 'env', operator: '=', value: 'prod' }],
        datasource: { uid: 'ds-1' },
        applicabilityEnabled: true,
      });

      const panel1 = new VizPanel({
        key: 'panel-1',
        title: 'Panel 1',
        pluginId: 'timeseries',
        $data: new SceneQueryRunner({
          datasource: { uid: 'ds-1' },
          queries: [{ refId: 'A', datasource: { uid: 'ds-1' } }],
        }),
      });

      getDrilldownsApplicabilityMock.mockResolvedValue(
        new Map([['panel-1', mockApplicabilityPanelQueries]])
      );

      const applicabilityManager = new ApplicabilityManager();
      const scene = new DashboardScene({
        $variables: new SceneVariableSet({ variables: [adhocVar] }),
        $behaviors: [applicabilityManager],
        body: DefaultGridLayoutManager.fromVizPanels([panel1]),
      });

      activateFullSceneTree(scene);
      await new Promise((r) => setTimeout(r, 1));

      expect(getDrilldownsApplicabilityMock).toHaveBeenCalledTimes(1);

      adhocVar.setState({
        filters: [{ key: 'env', operator: '=', value: 'staging' }],
      });

      await new Promise((r) => setTimeout(r, 1));

      expect(getDrilldownsApplicabilityMock).toHaveBeenCalledTimes(2);
    });
  });
});
