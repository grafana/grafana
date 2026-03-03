import { DataSourceInstanceSettings, DataTransformerConfig, getDataSourceRef, PluginType } from '@grafana/data';
import { config } from '@grafana/runtime';
import { SceneDataTransformer, sceneGraph, SceneObjectRef, SceneQueryRunner, VizPanel } from '@grafana/scenes';
import { DataQuery } from '@grafana/schema';

import { PanelTimeRange, PanelTimeRangeState } from '../../scene/panel-timerange/PanelTimeRange';

import { PanelDataPaneNext } from './PanelDataPaneNext';

const mockGetInstanceSettings = jest.fn();

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getDataSourceSrv: () => ({
    getInstanceSettings: mockGetInstanceSettings,
  }),
}));

// Mutable state object for the mock queryRunner
const mockQueryRunnerState: {
  datasource: { uid: string; type: string } | undefined;
  queries: unknown[];
  maxDataPoints: number | undefined;
  minInterval: string | undefined;
  cacheTimeout: string | undefined;
  queryCachingTTL: number | undefined;
} = {
  datasource: undefined,
  queries: [],
  maxDataPoints: undefined,
  minInterval: undefined,
  cacheTimeout: undefined,
  queryCachingTTL: undefined,
};

// Mock getQueryRunnerFor to return our mock queryRunner
const mockQueryRunner = {
  get state() {
    return mockQueryRunnerState;
  },
  setState: jest.fn(),
  runQueries: jest.fn(),
} as unknown as SceneQueryRunner;

// Mockable getDashboardSceneFor for localStorage tests
const mockGetDashboardSceneFor = jest.fn();

jest.mock('../../utils/utils', () => ({
  ...jest.requireActual('../../utils/utils'),
  getQueryRunnerFor: () => mockQueryRunner,
  getDashboardSceneFor: (sceneObject: unknown) => mockGetDashboardSceneFor(sceneObject),
}));

jest.mock('../getPanelFrameOptions', () => ({
  getUpdatedHoverHeader: jest.fn(() => false),
}));

// Mock sceneGraph.getTimeRange
jest.spyOn(sceneGraph, 'getTimeRange').mockReturnValue({} as ReturnType<typeof sceneGraph.getTimeRange>);

jest.mock('@grafana/data', () => ({
  ...jest.requireActual('@grafana/data'),
  store: {
    exists: jest.fn(),
    get: jest.fn(),
    getObject: jest.fn((_key, defaultValue) => defaultValue),
    setObject: jest.fn(),
    delete: jest.fn(),
  },
}));

describe('PanelDataPaneNext', () => {
  let dataPane: PanelDataPaneNext;
  let mockPanel: VizPanel;

  beforeEach(() => {
    jest.clearAllMocks();

    // Default getDashboardSceneFor to throw (tests that need it should mock it explicitly)
    mockGetDashboardSceneFor.mockImplementation(() => {
      throw new Error('getDashboardSceneFor called but not mocked for this test');
    });

    const panelState: { title: string; $timeRange: unknown } = { title: 'Test Panel', $timeRange: undefined };
    mockPanel = {
      get state() {
        return panelState;
      },
      // Propagate setState so live state reads in onQueryOptionsChange see real values.
      setState: jest.fn().mockImplementation((update: Partial<typeof panelState>) => {
        Object.assign(panelState, update);
      }),
    } as unknown as VizPanel;

    const mockPanelRef = {
      resolve: () => mockPanel,
    } as SceneObjectRef<VizPanel>;

    dataPane = new PanelDataPaneNext({
      panelRef: mockPanelRef,
    });

    // Reset mock queryRunner state
    Object.assign(mockQueryRunnerState, {
      datasource: undefined,
      queries: [],
      maxDataPoints: undefined,
      minInterval: undefined,
      cacheTimeout: undefined,
      queryCachingTTL: undefined,
    });
  });

  describe('onQueryOptionsChange', () => {
    describe('max data points and min interval', () => {
      it('should update maxDataPoints on SceneQueryRunner', () => {
        dataPane.onQueryOptionsChange({
          dataSource: { type: 'test', uid: 'test' },
          queries: [],
          maxDataPoints: 500,
        });

        expect(mockQueryRunner.setState).toHaveBeenCalledWith(
          expect.objectContaining({
            maxDataPoints: 500,
          })
        );
        expect(mockQueryRunner.runQueries).toHaveBeenCalled();
      });

      it('should update minInterval on SceneQueryRunner', () => {
        dataPane.onQueryOptionsChange({
          dataSource: { type: 'test', uid: 'test' },
          queries: [],
          minInterval: '10s',
        });

        expect(mockQueryRunner.setState).toHaveBeenCalledWith(
          expect.objectContaining({
            minInterval: '10s',
          })
        );
        expect(mockQueryRunner.runQueries).toHaveBeenCalled();
      });

      it('should clear maxDataPoints when set to null', () => {
        mockQueryRunnerState.maxDataPoints = 500;

        dataPane.onQueryOptionsChange({
          dataSource: { type: 'test', uid: 'test' },
          queries: [],
          maxDataPoints: null,
        });

        expect(mockQueryRunner.setState).toHaveBeenCalledWith(
          expect.objectContaining({
            maxDataPoints: undefined,
          })
        );
      });

      it('should clear minInterval when set to null', () => {
        mockQueryRunnerState.minInterval = '10s';

        dataPane.onQueryOptionsChange({
          dataSource: { type: 'test', uid: 'test' },
          queries: [],
          minInterval: null,
        });

        expect(mockQueryRunner.setState).toHaveBeenCalledWith(
          expect.objectContaining({
            minInterval: undefined,
          })
        );
      });
    });

    describe('time overrides', () => {
      it('should create PanelTimeRange when timeRange.from is set', () => {
        dataPane.onQueryOptionsChange({
          dataSource: { type: 'test', uid: 'test' },
          queries: [],
          timeRange: { from: '1h' },
        });

        expect(mockPanel.setState).toHaveBeenCalledWith(
          expect.objectContaining({
            $timeRange: expect.any(PanelTimeRange),
          })
        );

        const panelSetStateCall = (mockPanel.setState as jest.Mock).mock.calls[0][0];
        expect((panelSetStateCall.$timeRange.state as PanelTimeRangeState).timeFrom).toBe('1h');
      });

      it('should create PanelTimeRange when timeRange.shift is set', () => {
        dataPane.onQueryOptionsChange({
          dataSource: { type: 'test', uid: 'test' },
          queries: [],
          timeRange: { shift: '2h' },
        });

        expect(mockPanel.setState).toHaveBeenCalledWith(
          expect.objectContaining({
            $timeRange: expect.any(PanelTimeRange),
          })
        );

        const panelSetStateCall = (mockPanel.setState as jest.Mock).mock.calls[0][0];
        expect((panelSetStateCall.$timeRange.state as PanelTimeRangeState).timeShift).toBe('2h');
      });

      it('should remove PanelTimeRange when time options are cleared', () => {
        // First set a time range
        dataPane.onQueryOptionsChange({
          dataSource: { type: 'test', uid: 'test' },
          queries: [],
          timeRange: { from: '1h' },
        });

        // Then clear it
        dataPane.onQueryOptionsChange({
          dataSource: { type: 'test', uid: 'test' },
          queries: [],
          timeRange: { from: undefined, shift: undefined },
        });

        const lastCall = (mockPanel.setState as jest.Mock).mock.calls.at(-1)[0];
        expect(lastCall.$timeRange).toBeUndefined();
      });

      it('should set hideTimeOverride on PanelTimeRange', () => {
        dataPane.onQueryOptionsChange({
          dataSource: { type: 'test', uid: 'test' },
          queries: [],
          timeRange: { from: '1h', hide: true },
        });

        const panelSetStateCall = (mockPanel.setState as jest.Mock).mock.calls[0][0];
        expect((panelSetStateCall.$timeRange.state as PanelTimeRangeState).hideTimeOverride).toBe(true);
      });
    });

    describe('caching options', () => {
      it('should update cacheTimeout', () => {
        dataPane.onQueryOptionsChange({
          dataSource: { type: 'test', uid: 'test' },
          queries: [],
          cacheTimeout: '60',
        });

        expect(mockQueryRunner.setState).toHaveBeenCalledWith(
          expect.objectContaining({
            cacheTimeout: '60',
          })
        );
      });

      it('should update queryCachingTTL', () => {
        dataPane.onQueryOptionsChange({
          dataSource: { type: 'test', uid: 'test' },
          queries: [],
          queryCachingTTL: 300000,
        });

        expect(mockQueryRunner.setState).toHaveBeenCalledWith(
          expect.objectContaining({
            queryCachingTTL: 300000,
          })
        );
      });
    });

    it('should call runQueries', () => {
      dataPane.onQueryOptionsChange({
        dataSource: { type: 'test', uid: 'test' },
        queries: [],
        maxDataPoints: 100,
        minInterval: '5s',
        timeRange: { from: '1h' },
      });

      expect(mockQueryRunner.runQueries).toHaveBeenCalledTimes(1);
    });
  });

  describe('transformations', () => {
    const mockTransformations: DataTransformerConfig[] = [
      { id: 'organize', options: {} },
      { id: 'reduce', options: {} },
      { id: 'filter', options: {} },
    ];

    let mockTransformer: SceneDataTransformer;

    beforeEach(() => {
      mockTransformer = new SceneDataTransformer({
        transformations: mockTransformations,
        $data: mockQueryRunner,
      });

      jest.spyOn(mockTransformer, 'setState');
      mockPanel.state.$data = mockTransformer;
    });

    describe('addTransformation', () => {
      it('should append a transformation to the end by default', () => {
        jest.spyOn(mockTransformer, 'reprocessTransformations').mockImplementation(() => {});

        dataPane.addTransformation('seriesToColumns');

        expect(mockTransformer.setState).toHaveBeenCalledWith({
          transformations: [
            { id: 'organize', options: {} },
            { id: 'reduce', options: {} },
            { id: 'filter', options: {} },
            { id: 'seriesToColumns', options: {} },
          ],
        });
        expect(mockTransformer.reprocessTransformations).toHaveBeenCalled();
      });

      it('should insert a transformation after a specific index', () => {
        jest.spyOn(mockTransformer, 'reprocessTransformations').mockImplementation(() => {});

        dataPane.addTransformation('seriesToColumns', 0);

        expect(mockTransformer.setState).toHaveBeenCalledWith({
          transformations: [
            { id: 'organize', options: {} },
            { id: 'seriesToColumns', options: {} },
            { id: 'reduce', options: {} },
            { id: 'filter', options: {} },
          ],
        });
      });

      it('should not throw when $data is not SceneDataTransformer', () => {
        mockPanel.state.$data = undefined;
        expect(() => dataPane.addTransformation('seriesToColumns')).not.toThrow();
      });
    });

    describe('reorderTransformations', () => {
      it('should update transformations and reprocess when $data is SceneDataTransformer', () => {
        jest.spyOn(mockTransformer, 'reprocessTransformations').mockImplementation(() => {});

        const newOrder: DataTransformerConfig[] = [
          { id: 'reduce', options: {} },
          { id: 'organize', options: {} },
        ];

        dataPane.reorderTransformations(newOrder);

        expect(mockTransformer.setState).toHaveBeenCalledWith({ transformations: newOrder });
        expect(mockTransformer.reprocessTransformations).toHaveBeenCalled();
      });

      it('should not throw when $data is not SceneDataTransformer', () => {
        mockPanel.state.$data = undefined;
        const newOrder: DataTransformerConfig[] = [{ id: 'reduce', options: {} }];

        expect(() => dataPane.reorderTransformations(newOrder)).not.toThrow();
      });
    });

    describe('deleteTransformation', () => {
      it('should delete a transformation', () => {
        dataPane.deleteTransformation(1);

        expect(mockTransformer.setState).toHaveBeenCalledWith({
          transformations: [
            { id: 'organize', options: {} },
            { id: 'filter', options: {} },
          ],
        });
        expect(mockQueryRunner.runQueries).toHaveBeenCalled();
      });

      it('should not delete a transformation if the index is out of bounds', () => {
        dataPane.deleteTransformation(-1);
        expect(mockTransformer.setState).not.toHaveBeenCalled();

        dataPane.deleteTransformation(5);
        expect(mockTransformer.setState).not.toHaveBeenCalled();

        dataPane.deleteTransformation(3);
        expect(mockTransformer.setState).not.toHaveBeenCalled();
      });
    });

    describe('toggleTransformationDisabled', () => {
      it('should toggle the disabled state of a transformation', () => {
        dataPane.toggleTransformationDisabled(1);

        expect(mockTransformer.setState).toHaveBeenCalledWith({
          transformations: [
            { id: 'organize', options: {} },
            { id: 'reduce', options: {}, disabled: true },
            { id: 'filter', options: {} },
          ],
        });
      });

      it('should not toggle if the index is out of bounds', () => {
        dataPane.toggleTransformationDisabled(-1);
        expect(mockTransformer.setState).not.toHaveBeenCalled();

        dataPane.toggleTransformationDisabled(5);
        expect(mockTransformer.setState).not.toHaveBeenCalled();
      });
    });
  });

  describe('addQuery', () => {
    const promDsSettings = {
      uid: 'prom-1',
      type: 'prometheus',
      name: 'Prometheus',
      meta: { mixed: false },
    } as unknown as DataSourceInstanceSettings;

    const mixedDsSettings = {
      uid: '-- Mixed --',
      type: 'mixed',
      name: 'Mixed',
      meta: { mixed: true },
    } as unknown as DataSourceInstanceSettings;

    const defaultDsSettings = {
      uid: 'gdev-testdata',
      type: 'testdata',
      name: 'TestData',
      meta: { mixed: false },
    } as unknown as DataSourceInstanceSettings;

    it('should assign the panel datasource when it is not Mixed', () => {
      mockQueryRunnerState.queries = [{ refId: 'A', datasource: { type: 'prometheus', uid: 'prom-1' } }];

      dataPane.setState({ dsSettings: promDsSettings });

      const refId = dataPane.addQuery();

      expect(refId).toBe('B');
      expect(mockQueryRunner.setState).toHaveBeenCalledWith({
        queries: expect.arrayContaining([
          expect.objectContaining({
            refId: 'B',
            datasource: getDataSourceRef(promDsSettings),
          }),
        ]),
      });
    });

    it('should assign the default datasource when the panel datasource is Mixed', () => {
      mockQueryRunnerState.queries = [{ refId: 'A', datasource: { type: 'prometheus', uid: 'prom-1' } }];

      dataPane.setState({ dsSettings: mixedDsSettings });

      const originalDefault = config.defaultDatasource;
      config.defaultDatasource = 'gdev-testdata';

      mockGetInstanceSettings.mockImplementation((ref: string) => {
        if (ref === 'gdev-testdata') {
          return defaultDsSettings;
        }
        return undefined;
      });

      try {
        const refId = dataPane.addQuery();

        expect(refId).toBe('B');
        expect(mockQueryRunner.setState).toHaveBeenCalledWith({
          queries: expect.arrayContaining([
            expect.objectContaining({
              refId: 'B',
              datasource: getDataSourceRef(defaultDsSettings),
            }),
          ]),
        });
      } finally {
        config.defaultDatasource = originalDefault;
      }
    });

    it('should preserve a caller-supplied datasource (e.g. expressions)', () => {
      mockQueryRunnerState.queries = [{ refId: 'A', datasource: { type: 'prometheus', uid: 'prom-1' } }];

      dataPane.setState({ dsSettings: promDsSettings });

      const expressionDs = { type: '__expr__', uid: '__expr__' };
      const refId = dataPane.addQuery({ datasource: expressionDs });

      expect(refId).toBe('B');
      expect(mockQueryRunner.setState).toHaveBeenCalledWith({
        queries: expect.arrayContaining([
          expect.objectContaining({
            refId: 'B',
            datasource: expressionDs,
          }),
        ]),
      });
    });
  });

  /**
   * Tests for resolveDatasourceRef — the synchronous resolution step that runs before
   * loadDatasource. Returns a DataSourceRef to pass into loadDatasource; does NOT mutate
   * queryRunner to avoid bleeding into the dashboard save path.
   *
   * Priority chain (mirrors legacy PanelEditorQueries.componentDidMount):
   *   1. queryRunner.state.datasource already set      → returns undefined (loadDatasource uses it directly)
   *   2. queries[0] has explicit datasource            → returns undefined (same)
   *   3. localStorage has a resolvable datasource UID  → returns that ref
   *   4. localStorage UID is stale / no entry          → returns the configured default ref
   */
  describe('resolveDatasourceRef', () => {
    const promSettings: DataSourceInstanceSettings = {
      uid: 'stored-prom-uid',
      type: 'prometheus',
      name: 'Prometheus Stored',
      access: 'proxy',
      meta: {
        id: 'prometheus',
        name: 'Prometheus',
        type: PluginType.datasource,
        info: {
          author: { name: '' },
          description: '',
          links: [],
          logos: { small: '', large: '' },
          screenshots: [],
          updated: '',
          version: '',
        },
        module: '',
        baseUrl: '',
      },
      readOnly: false,
      jsonData: {},
    };

    const defaultSettings: DataSourceInstanceSettings = {
      ...promSettings,
      uid: 'default-ds-uid',
      name: 'TestData (default)',
      type: 'testdata',
    };

    let mockGetLastUsed: jest.Mock;
    let testDataPane: PanelDataPaneNext;

    const callResolveDatasourceRef = () =>
      (
        testDataPane as unknown as { resolveDatasourceRef: () => ReturnType<typeof getDataSourceRef> | undefined }
      ).resolveDatasourceRef();

    beforeEach(() => {
      mockGetLastUsed = jest.fn();
      jest
        .spyOn(require('app/features/dashboard/utils/dashboard'), 'getLastUsedDatasourceFromStorage')
        .mockImplementation(mockGetLastUsed);

      mockGetDashboardSceneFor.mockReturnValue({ state: { uid: 'test-dashboard-uid' } });

      mockQueryRunnerState.datasource = undefined;
      mockQueryRunnerState.queries = [{ refId: 'A' }]; // No explicit datasource

      testDataPane = new PanelDataPaneNext({
        panelRef: { resolve: () => mockPanel } as SceneObjectRef<VizPanel>,
      });
    });

    it('should return the localStorage datasource ref when it is available and resolvable', () => {
      mockGetLastUsed.mockReturnValue({ datasourceUid: promSettings.uid });
      mockGetInstanceSettings.mockImplementation((ref: { uid?: string } | string) => {
        const uid = typeof ref === 'string' ? ref : ref?.uid;
        return uid === promSettings.uid ? promSettings : undefined;
      });

      const result = callResolveDatasourceRef();

      expect(mockGetLastUsed).toHaveBeenCalledWith('test-dashboard-uid');
      expect(result).toEqual(getDataSourceRef(promSettings));
      expect(mockQueryRunner.setState).not.toHaveBeenCalled();
    });

    it('should return the default datasource ref when the localStorage UID is stale (not found in registry)', () => {
      mockGetLastUsed.mockReturnValue({ datasourceUid: 'deleted-or-renamed-uid' });
      mockGetInstanceSettings.mockImplementation((ref: string) => {
        // Stale UID resolves to nothing; default resolves correctly.
        if (ref === config.defaultDatasource) {
          return defaultSettings;
        }
        return undefined;
      });

      const result = callResolveDatasourceRef();

      expect(result).toEqual(getDataSourceRef(defaultSettings));
      expect(mockQueryRunner.setState).not.toHaveBeenCalled();
    });

    it('should return the default datasource ref when there is no localStorage entry for this dashboard', () => {
      mockGetLastUsed.mockReturnValue(undefined);
      mockGetInstanceSettings.mockImplementation((ref: string) => {
        if (ref === config.defaultDatasource) {
          return defaultSettings;
        }
        return undefined;
      });

      const result = callResolveDatasourceRef();

      expect(result).toEqual(getDataSourceRef(defaultSettings));
      expect(mockQueryRunner.setState).not.toHaveBeenCalled();
    });

    it('should return undefined when queryRunner already has a datasource set', () => {
      mockQueryRunnerState.datasource = { uid: 'already-set-uid', type: 'prometheus' };

      const result = callResolveDatasourceRef();

      expect(result).toBeUndefined();
      expect(mockGetLastUsed).not.toHaveBeenCalled();
      expect(mockQueryRunner.setState).not.toHaveBeenCalled();
    });

    it('should return undefined when the first query already has an explicit datasource', () => {
      mockQueryRunnerState.datasource = undefined;
      mockQueryRunnerState.queries = [{ refId: 'A', datasource: { uid: 'prom-uid', type: 'prometheus' } }];

      const result = callResolveDatasourceRef();

      // loadDatasource will infer the datasource from queries[0] — no need to resolve here.
      expect(result).toBeUndefined();
      expect(mockGetLastUsed).not.toHaveBeenCalled();
      expect(mockQueryRunner.setState).not.toHaveBeenCalled();
    });

    it('should use the dashboard uid as the localStorage key (empty string for unsaved dashboards)', () => {
      mockGetDashboardSceneFor.mockReturnValue({ state: { uid: '' } });
      mockGetLastUsed.mockReturnValue(undefined);
      mockGetInstanceSettings.mockReturnValue(defaultSettings);

      const result = callResolveDatasourceRef();

      expect(mockGetLastUsed).toHaveBeenCalledWith('');
      // Falls back to default — editor should still open, not break
      expect(result).toEqual(getDataSourceRef(defaultSettings));
      expect(mockQueryRunner.setState).not.toHaveBeenCalled();
    });

    describe('integration with loadDatasource', () => {
      beforeEach(() => {
        jest
          .spyOn(require('app/features/datasources/components/picker/utils'), 'storeLastUsedDataSourceInLocalStorage')
          .mockImplementation(jest.fn());
      });

      const callLoadDatasource = (resolvedRef?: ReturnType<typeof getDataSourceRef>) =>
        (
          testDataPane as unknown as {
            loadDatasource: (ref?: ReturnType<typeof getDataSourceRef>) => Promise<void>;
          }
        ).loadDatasource(resolvedRef);

      it('should load the default datasource when the panel has no datasource and localStorage has no entry (original bug scenario)', async () => {
        // Exact conditions that triggered "Failed to load datasource for this query":
        // - queryRunner has no datasource (saved with default / never explicitly set)
        // - no query-level datasource either
        // - no localStorage entry for this dashboard
        // Without resolveDatasourceRef passing a resolved ref into loadDatasource, loadDatasource
        // had nothing to load and silently left panelDsSettings undefined, causing the error.
        mockQueryRunnerState.datasource = undefined;
        mockQueryRunnerState.queries = [{ refId: 'A' }];
        mockGetLastUsed.mockReturnValue(undefined);

        const defaultDatasource = { uid: defaultSettings.uid, type: defaultSettings.type };

        jest.spyOn(require('@grafana/runtime'), 'getDataSourceSrv').mockReturnValue({
          get: jest.fn().mockResolvedValue(defaultDatasource),
          getInstanceSettings: jest.fn().mockImplementation((ref: string | { uid?: string }) => {
            const uid = typeof ref === 'string' ? ref : ref?.uid;
            return uid === defaultSettings.uid || ref === config.defaultDatasource ? defaultSettings : undefined;
          }),
        });

        const resolvedRef = callResolveDatasourceRef();
        await callLoadDatasource(resolvedRef);

        expect(testDataPane.state.datasource).toBe(defaultDatasource);
        expect(testDataPane.state.dsSettings).toBe(defaultSettings);
        expect(testDataPane.state.dsError).toBeUndefined();
        // queryRunner must remain untouched — no bleed into the save path
        expect(mockQueryRunner.setState).not.toHaveBeenCalled();
      });

      it('should result in a loaded datasource after resolveDatasourceRef + loadDatasource when localStorage has a valid entry', async () => {
        const promDatasource = { uid: promSettings.uid, type: promSettings.type };

        mockGetLastUsed.mockReturnValue({ datasourceUid: promSettings.uid });

        jest.spyOn(require('@grafana/runtime'), 'getDataSourceSrv').mockReturnValue({
          get: jest.fn().mockResolvedValue(promDatasource),
          getInstanceSettings: jest.fn().mockReturnValue(promSettings),
        });

        const resolvedRef = callResolveDatasourceRef();
        await callLoadDatasource(resolvedRef);

        expect(testDataPane.state.datasource).toBe(promDatasource);
        expect(testDataPane.state.dsSettings).toBe(promSettings);
        expect(testDataPane.state.dsError).toBeUndefined();
        // queryRunner must remain untouched — no bleed into the save path
        expect(mockQueryRunner.setState).not.toHaveBeenCalled();
      });
    });
  });

  /**
   * Tests for loadDatasource — the async step that loads the datasource plugin
   * and sets it on PanelDataPaneNext state so the query editor can render.
   */
  describe('loadDatasource', () => {
    const promSettings: DataSourceInstanceSettings = {
      uid: 'prom-uid',
      type: 'prometheus',
      name: 'Prometheus',
      access: 'proxy',
      meta: {
        id: 'prometheus',
        name: 'Prometheus',
        type: PluginType.datasource,
        info: {
          author: { name: '' },
          description: '',
          links: [],
          logos: { small: '', large: '' },
          screenshots: [],
          updated: '',
          version: '',
        },
        module: '',
        baseUrl: '',
      },
      readOnly: false,
      jsonData: {},
    };

    const defaultSettings: DataSourceInstanceSettings = {
      ...promSettings,
      uid: 'default-uid',
      name: 'TestData (default)',
      type: 'testdata',
    };

    const mixedSettings: DataSourceInstanceSettings = {
      ...promSettings,
      uid: '-- Mixed --',
      name: 'Mixed',
      type: 'mixed',
      meta: { ...promSettings.meta, id: 'mixed', name: 'Mixed', mixed: true },
    };

    const promDatasource = { uid: 'prom-uid', type: 'prometheus' };
    const defaultDatasource = { uid: 'default-uid', type: 'testdata' };

    let mockGet: jest.Mock;
    let testDataPane: PanelDataPaneNext;

    const callLoadDatasource = () =>
      (testDataPane as unknown as { loadDatasource: () => Promise<void> }).loadDatasource();

    beforeEach(() => {
      mockGet = jest.fn();

      jest.spyOn(require('@grafana/runtime'), 'getDataSourceSrv').mockReturnValue({
        get: mockGet,
        getInstanceSettings: mockGetInstanceSettings,
      });

      jest
        .spyOn(require('app/features/datasources/components/picker/utils'), 'storeLastUsedDataSourceInLocalStorage')
        .mockImplementation(jest.fn());

      testDataPane = new PanelDataPaneNext({
        panelRef: { resolve: () => mockPanel } as SceneObjectRef<VizPanel>,
      });
    });

    it('should load the datasource and set state when everything resolves correctly', async () => {
      mockQueryRunnerState.datasource = { uid: 'prom-uid', type: 'prometheus' };
      mockGet.mockResolvedValue(promDatasource);
      mockGetInstanceSettings.mockReturnValue(promSettings);

      await callLoadDatasource();

      expect(testDataPane.state.datasource).toBe(promDatasource);
      expect(testDataPane.state.dsSettings).toBe(promSettings);
      expect(testDataPane.state.dsError).toBeUndefined();
    });

    it('should store the datasource in localStorage after a successful load', async () => {
      const mockStore = jest.spyOn(
        require('app/features/datasources/components/picker/utils'),
        'storeLastUsedDataSourceInLocalStorage'
      );
      mockQueryRunnerState.datasource = { uid: 'prom-uid', type: 'prometheus' };
      mockGet.mockResolvedValue(promDatasource);
      mockGetInstanceSettings.mockReturnValue(promSettings);

      await callLoadDatasource();

      expect(mockStore).toHaveBeenCalled();
    });

    it('should fall back to the default datasource when the primary load throws', async () => {
      mockQueryRunnerState.datasource = { uid: 'deleted-uid', type: 'prometheus' };

      mockGet.mockImplementation((ref: { uid?: string }) => {
        if (ref?.uid === 'deleted-uid') {
          return Promise.reject(new Error('Datasource not found'));
        }
        return Promise.resolve(defaultDatasource);
      });
      mockGetInstanceSettings.mockReturnValue(defaultSettings);

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      await callLoadDatasource();
      consoleErrorSpy.mockRestore();

      // Should recover gracefully with the default datasource
      expect(testDataPane.state.datasource).toBe(defaultDatasource);
      expect(testDataPane.state.dsSettings).toBe(defaultSettings);
      expect(testDataPane.state.dsError).toBeUndefined();
    });

    it('should not call queryRunner.setState in the fallback path (avoids triggering a second loadDatasource via the subscription)', async () => {
      mockQueryRunnerState.datasource = { uid: 'deleted-uid', type: 'prometheus' };

      mockGet.mockImplementation((ref: { uid?: string }) => {
        if (ref?.uid === 'deleted-uid') {
          return Promise.reject(new Error('Datasource not found'));
        }
        return Promise.resolve(defaultDatasource);
      });
      mockGetInstanceSettings.mockReturnValue(defaultSettings);

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      await callLoadDatasource();
      consoleErrorSpy.mockRestore();

      expect(mockQueryRunner.setState).not.toHaveBeenCalled();
    });

    it('should attempt the default fallback when get() succeeds but getInstanceSettings() returns undefined', async () => {
      mockQueryRunnerState.datasource = { uid: 'prom-uid', type: 'prometheus' };
      mockGet.mockResolvedValue(promDatasource);
      // Settings missing from registry — e.g. plugin not registered
      mockGetInstanceSettings.mockImplementation((ref: { uid?: string } | string) => {
        const uid = typeof ref === 'string' ? ref : ref?.uid;
        if (uid === config.defaultDatasource) {
          return defaultSettings;
        }
        return undefined;
      });

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      // mockGet resolves for both primary and default
      mockGet.mockImplementation((ref: { uid?: string } | string | undefined) => {
        const uid = typeof ref === 'string' ? ref : (ref as { uid?: string })?.uid;
        return uid === 'prom-uid' ? Promise.resolve(promDatasource) : Promise.resolve(defaultDatasource);
      });

      await callLoadDatasource();
      consoleErrorSpy.mockRestore();

      // Should recover with the default datasource rather than staying broken
      expect(testDataPane.state.datasource).toBe(defaultDatasource);
      expect(testDataPane.state.dsSettings).toBe(defaultSettings);
      expect(testDataPane.state.dsError).toBeUndefined();
    });

    it('should set dsError and clear datasource when both primary and default fail', async () => {
      mockQueryRunnerState.datasource = { uid: 'deleted-uid', type: 'prometheus' };
      const primaryError = new Error('Primary DS not found');
      mockGet.mockRejectedValue(primaryError);

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      await callLoadDatasource();
      consoleErrorSpy.mockRestore();

      expect(testDataPane.state.datasource).toBeUndefined();
      expect(testDataPane.state.dsSettings).toBeUndefined();
      expect(testDataPane.state.dsError).toBe(primaryError);
    });

    it('should handle a Mixed panel datasource and reflect meta.mixed in state', async () => {
      mockQueryRunnerState.datasource = { uid: '-- Mixed --', type: 'mixed' };
      const mixedDatasource = { uid: '-- Mixed --', type: 'mixed' };
      mockGet.mockResolvedValue(mixedDatasource);
      mockGetInstanceSettings.mockReturnValue(mixedSettings);

      await callLoadDatasource();

      expect(testDataPane.state.dsSettings?.meta.mixed).toBe(true);
      expect(testDataPane.state.dsError).toBeUndefined();
    });

    it('should do nothing and clear state when there is no datasource to load', async () => {
      // Both queryRunner.state.datasource and queries[0].datasource are null
      mockQueryRunnerState.datasource = undefined;
      mockQueryRunnerState.queries = [{ refId: 'A' }];

      await callLoadDatasource();

      expect(mockGet).not.toHaveBeenCalled();
      expect(testDataPane.state.datasource).toBeUndefined();
      expect(testDataPane.state.dsSettings).toBeUndefined();
      expect(testDataPane.state.dsError).toBeUndefined();
    });

    it('should use queries[0].datasource when queryRunner.state.datasource is null', async () => {
      mockQueryRunnerState.datasource = undefined;
      mockQueryRunnerState.queries = [{ refId: 'A', datasource: { uid: 'prom-uid', type: 'prometheus' } }];
      mockGet.mockResolvedValue(promDatasource);
      mockGetInstanceSettings.mockReturnValue(promSettings);

      await callLoadDatasource();

      expect(mockGet).toHaveBeenCalledWith({ uid: 'prom-uid', type: 'prometheus' });
      expect(testDataPane.state.datasource).toBe(promDatasource);
    });
  });

  /**
   * Tests for changeDataSource — the method that handles per-query datasource switching
   * and the transition to Mixed mode when queries start using different datasources.
   *
   * The two most critical behaviors:
   * 1. Orphan stamping: when transitioning to Mixed, any query without an explicit
   *    datasource must have the current panel datasource frozen onto it. Without this,
   *    that query would be in a Mixed panel with no way to edit it.
   * 2. Safe fallback ref: when currentPanelDsRef is null during the Mixed transition,
   *    the default datasource is used instead of crashing.
   */
  describe('changeDataSource', () => {
    const promSettings: DataSourceInstanceSettings = {
      uid: 'prom-uid',
      type: 'prometheus',
      name: 'Prometheus',
      access: 'proxy',
      meta: {
        id: 'prometheus',
        name: 'Prometheus',
        type: PluginType.datasource,
        info: {
          author: { name: '' },
          description: '',
          links: [],
          logos: { small: '', large: '' },
          screenshots: [],
          updated: '',
          version: '',
        },
        module: '',
        baseUrl: '',
      },
      readOnly: false,
      jsonData: {},
    };

    const lokiSettings: DataSourceInstanceSettings = {
      ...promSettings,
      uid: 'loki-uid',
      name: 'Loki',
      type: 'loki',
      meta: { ...promSettings.meta, id: 'loki', name: 'Loki' },
    };

    const defaultSettings: DataSourceInstanceSettings = {
      ...promSettings,
      uid: 'default-uid',
      name: 'Default DS',
      type: 'testdata',
    };

    // A second prometheus instance — same type, different UID. Used in tests that want to
    // trigger the Mixed transition WITHOUT the getDefaultQuery path (same type = no reset).
    const promInstance2Settings: DataSourceInstanceSettings = {
      ...promSettings,
      uid: 'prom-uid-2',
      name: 'Prometheus 2',
    };

    let mockGet: jest.Mock;
    let testDataPane: PanelDataPaneNext;

    beforeEach(() => {
      // Default: return an empty DS api object. Tests that need getDefaultQuery override this.
      mockGet = jest.fn().mockResolvedValue({});

      jest.spyOn(require('@grafana/runtime'), 'getDataSourceSrv').mockReturnValue({
        get: mockGet,
        getInstanceSettings: mockGetInstanceSettings,
      });

      testDataPane = new PanelDataPaneNext({
        panelRef: { resolve: () => mockPanel } as SceneObjectRef<VizPanel>,
      });
    });

    it('should transition the panel to Mixed mode when changing a query datasource for the first time', async () => {
      // Use same type (prometheus → prometheus-2) so the getDefaultQuery branch is skipped.
      mockQueryRunnerState.datasource = { uid: 'prom-uid', type: 'prometheus' };
      mockQueryRunnerState.queries = [
        { refId: 'A', datasource: { uid: 'prom-uid', type: 'prometheus' } },
        { refId: 'B', datasource: { uid: 'prom-uid', type: 'prometheus' } },
      ];

      mockGetInstanceSettings.mockReturnValue(promInstance2Settings);

      await testDataPane.changeDataSource({ uid: 'prom-uid-2', type: 'prometheus' }, 'A');

      expect(mockQueryRunner.setState).toHaveBeenCalledWith(
        expect.objectContaining({
          datasource: { type: 'mixed', uid: '-- Mixed --' },
        })
      );
    });

    it('should stamp the current panel datasource onto orphaned queries when transitioning to Mixed', async () => {
      // Query A is being changed; Query B has no explicit datasource (orphan); Query C has one.
      // When we go Mixed, B must get the panel's prom ds stamped onto it.
      // Uses same type (prom → prom-2) to avoid the getDefaultQuery path.
      mockQueryRunnerState.datasource = { uid: 'prom-uid', type: 'prometheus' };
      mockQueryRunnerState.queries = [
        { refId: 'A', datasource: { uid: 'prom-uid', type: 'prometheus' } }, // being changed
        { refId: 'B' }, // orphan — no explicit datasource
        { refId: 'C', datasource: { uid: 'loki-uid', type: 'loki' } }, // already explicit
      ];

      mockGetInstanceSettings.mockImplementation((ref: { uid?: string } | string) => {
        const uid = typeof ref === 'string' ? ref : ref?.uid;
        if (uid === 'prom-uid-2') {
          return promInstance2Settings;
        }
        if (uid === 'loki-uid') {
          return lokiSettings;
        }
        return promSettings;
      });

      await testDataPane.changeDataSource({ uid: 'prom-uid-2', type: 'prometheus' }, 'A');

      const setStateCall = (mockQueryRunner.setState as jest.Mock).mock.calls.find(
        ([args]) => args.datasource?.uid === '-- Mixed --'
      );

      expect(setStateCall).toBeDefined();
      const { queries } = setStateCall![0];

      // Query A: updated to prom-uid-2
      expect(queries.find((q: DataQuery) => q.refId === 'A').datasource).toEqual({
        uid: 'prom-uid-2',
        type: 'prometheus',
      });
      // Query B: stamped with the panel's prometheus datasource (was orphaned)
      expect(queries.find((q: DataQuery) => q.refId === 'B').datasource).toEqual({
        uid: 'prom-uid',
        type: 'prometheus',
      });
      // Query C: unchanged — it already had an explicit datasource
      expect(queries.find((q: DataQuery) => q.refId === 'C').datasource).toEqual({
        uid: 'loki-uid',
        type: 'loki',
      });
    });

    it('should not re-transition when the panel is already Mixed', async () => {
      // Panel is already Mixed; query A switches from prom → prom-2 (same type, no getDefaultQuery).
      mockQueryRunnerState.datasource = { uid: '-- Mixed --', type: 'mixed' };
      mockQueryRunnerState.queries = [
        { refId: 'A', datasource: { uid: 'prom-uid', type: 'prometheus' } },
        { refId: 'B', datasource: { uid: 'loki-uid', type: 'loki' } },
      ];

      mockGetInstanceSettings.mockReturnValue(promInstance2Settings);

      await testDataPane.changeDataSource({ uid: 'prom-uid-2', type: 'prometheus' }, 'A');

      const setStateCalls = (mockQueryRunner.setState as jest.Mock).mock.calls;
      // Should not set datasource to Mixed again (it's already Mixed)
      const mixedTransitionCall = setStateCalls.find(([args]) => args.datasource?.uid === '-- Mixed --');
      expect(mixedTransitionCall).toBeUndefined();

      // Should only update the target query
      const queriesUpdateCall = setStateCalls.find(([args]) => args.queries);
      expect(queriesUpdateCall).toBeDefined();
      const { queries } = queriesUpdateCall![0];
      expect(queries.find((q: DataQuery) => q.refId === 'A').datasource?.uid).toBe('prom-uid-2');
      expect(queries.find((q: DataQuery) => q.refId === 'B').datasource?.uid).toBe('loki-uid');
    });

    it('should apply getDefaultQuery when switching to a different datasource type', async () => {
      mockQueryRunnerState.datasource = { uid: 'prom-uid', type: 'prometheus' };
      mockQueryRunnerState.queries = [
        { refId: 'A', datasource: { uid: 'prom-uid', type: 'prometheus' }, expr: 'rate(requests[5m])' },
      ];

      // Different type (prom → loki) triggers the getDefaultQuery path.
      const lokiApi = {
        getDefaultQuery: jest.fn().mockReturnValue({ logQL: '', maxLines: 1000 }),
      };
      mockGet.mockResolvedValue(lokiApi);

      mockGetInstanceSettings.mockImplementation((ref: { uid?: string } | string) => {
        const uid = typeof ref === 'string' ? ref : ref?.uid;
        return uid === 'loki-uid' ? lokiSettings : promSettings;
      });

      await testDataPane.changeDataSource({ uid: 'loki-uid', type: 'loki' }, 'A');

      // find the Mixed setState call (if panel was not Mixed before, it transitions now)
      const allSetStateCalls = (mockQueryRunner.setState as jest.Mock).mock.calls;
      const queriesCall = allSetStateCalls.find(([args]) => args.queries);
      expect(queriesCall).toBeDefined();
      const queryA = queriesCall![0].queries.find((q: DataQuery) => q.refId === 'A');

      // Default query fields from the new DS are merged in. Note: because targetQuery is spread
      // AFTER getDefaultQuery(), type-specific fields from the old query (e.g. expr) survive
      // alongside the new defaults (e.g. logQL). The new DS plugin uses logQL and ignores expr.
      expect(queryA.logQL).toBe('');
      expect(queryA.maxLines).toBe(1000);
      expect(queryA.datasource?.uid).toBe('loki-uid');
    });

    it('should preserve the query model when switching to the same datasource type', async () => {
      mockQueryRunnerState.datasource = { uid: 'prom-uid', type: 'prometheus' };
      mockQueryRunnerState.queries = [
        { refId: 'A', datasource: { uid: 'prom-uid', type: 'prometheus' }, expr: 'rate(requests[5m])' },
      ];

      mockGetInstanceSettings.mockImplementation((ref: { uid?: string } | string) => {
        const uid = typeof ref === 'string' ? ref : ref?.uid;
        return uid === 'prom-uid-2' ? promInstance2Settings : promSettings;
      });

      await testDataPane.changeDataSource({ uid: 'prom-uid-2', type: 'prometheus' }, 'A');

      // getDefaultQuery should NOT have been called (same type, no default query reset)
      expect(mockGet).not.toHaveBeenCalled();

      const setStateCall = (mockQueryRunner.setState as jest.Mock).mock.calls.find(([args]) => args.queries);
      const queryA = setStateCall![0].queries.find((q: DataQuery) => q.refId === 'A');

      // PromQL expression preserved, only datasource ref updated
      expect(queryA.expr).toBe('rate(requests[5m])');
      expect(queryA.datasource?.uid).toBe('prom-uid-2');
    });

    it('should use the default datasource as the freeze-ref for orphans when currentPanelDsRef is null', async () => {
      // Scenario: panel has no explicit datasource (null), but a query datasource change is triggered.
      // The fallbackDsRef must not crash — it should use config.defaultDatasource instead.
      // Uses same type (prom → prom-2) to avoid the getDefaultQuery path.
      mockQueryRunnerState.datasource = undefined; // null panel-level ds
      mockQueryRunnerState.queries = [
        { refId: 'A', datasource: { uid: 'prom-uid', type: 'prometheus' } }, // being changed
        { refId: 'B' }, // orphan
      ];

      const originalDefault = config.defaultDatasource;
      config.defaultDatasource = 'default-uid';

      mockGetInstanceSettings.mockImplementation((ref: { uid?: string } | string) => {
        const uid = typeof ref === 'string' ? ref : ref?.uid;
        if (uid === 'prom-uid-2') {
          return promInstance2Settings;
        }
        if (uid === 'default-uid') {
          return defaultSettings;
        }
        return promSettings;
      });

      try {
        await testDataPane.changeDataSource({ uid: 'prom-uid-2', type: 'prometheus' }, 'A');
      } finally {
        config.defaultDatasource = originalDefault;
      }

      const setStateCall = (mockQueryRunner.setState as jest.Mock).mock.calls.find(
        ([args]) => args.datasource?.uid === '-- Mixed --'
      );
      expect(setStateCall).toBeDefined();

      const queryB = setStateCall![0].queries.find((q: DataQuery) => q.refId === 'B');
      // Orphan B should be stamped with the default datasource (not null/undefined)
      expect(queryB.datasource?.uid).toBe('default-uid');
    });

    it('should set dsError when the target datasource cannot be found in the registry', async () => {
      mockQueryRunnerState.datasource = { uid: 'prom-uid', type: 'prometheus' };
      mockQueryRunnerState.queries = [{ refId: 'A', datasource: { uid: 'prom-uid', type: 'prometheus' } }];

      mockGetInstanceSettings.mockReturnValue(undefined); // not found

      await testDataPane.changeDataSource({ uid: 'nonexistent-uid', type: 'unknown' }, 'A');

      expect(testDataPane.state.dsError).toBeInstanceOf(Error);
      expect(testDataPane.state.dsError?.message).toMatch(/nonexistent-uid/);
      // queryRunner must not have been touched — the change never went through
      expect(mockQueryRunner.setState).not.toHaveBeenCalled();
      expect(mockQueryRunner.runQueries).not.toHaveBeenCalled();
    });

    it('should set dsError and not update queries when get() fails during a type-change DS switch', async () => {
      mockQueryRunnerState.datasource = { uid: 'prom-uid', type: 'prometheus' };
      mockQueryRunnerState.queries = [{ refId: 'A', datasource: { uid: 'prom-uid', type: 'prometheus' } }];

      // First call: look up the new target (loki). Second call: look up the previous query DS (prom).
      // The type mismatch triggers shouldUseDefaultQuery=true, which calls get() — which then rejects.
      mockGetInstanceSettings.mockReturnValueOnce(lokiSettings).mockReturnValueOnce(promSettings);
      mockGet.mockRejectedValue(new Error('Plugin not found'));

      await testDataPane.changeDataSource({ uid: 'loki-uid', type: 'loki' }, 'A');

      expect(testDataPane.state.dsError).toBeInstanceOf(Error);
      expect(mockQueryRunner.setState).not.toHaveBeenCalled();
      expect(mockQueryRunner.runQueries).not.toHaveBeenCalled();
    });

    it('should run queries after the datasource change', async () => {
      mockQueryRunnerState.datasource = { uid: 'prom-uid', type: 'prometheus' };
      mockQueryRunnerState.queries = [{ refId: 'A', datasource: { uid: 'prom-uid', type: 'prometheus' } }];

      mockGetInstanceSettings.mockReturnValue(promInstance2Settings);

      await testDataPane.changeDataSource({ uid: 'prom-uid-2', type: 'prometheus' }, 'A');

      expect(mockQueryRunner.runQueries).toHaveBeenCalled();
    });
  });
});
