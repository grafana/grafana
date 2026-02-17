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

    mockPanel = {
      state: {
        title: 'Test Panel',
        $timeRange: undefined,
      },
      setState: jest.fn(),
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

    it('should always call runQueries after changes', () => {
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
      mockQueryRunnerState.queries = [{ refId: 'A', datasource: { type: 'prometheus', uid: 'prom-1' } }] as DataQuery[];

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

  describe('localStorage datasource loading', () => {
    it('should load datasource from localStorage when no datasource is available', async () => {
      // Clear all mocks to ensure clean state
      jest.clearAllMocks();

      const mockGetLastUsedDatasourceFromStorage = jest.fn().mockReturnValue({
        datasourceUid: 'stored-prom-uid',
      });

      const mockStoreLastUsedDataSourceInLocalStorage = jest.fn();

      const promDatasource = {
        uid: 'stored-prom-uid',
        type: 'prometheus',
        name: 'Prometheus Stored',
      };

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

      jest
        .spyOn(require('app/features/dashboard/utils/dashboard'), 'getLastUsedDatasourceFromStorage')
        .mockImplementation(mockGetLastUsedDatasourceFromStorage);

      jest
        .spyOn(require('app/features/datasources/components/picker/utils'), 'storeLastUsedDataSourceInLocalStorage')
        .mockImplementation(mockStoreLastUsedDataSourceInLocalStorage);

      const mockGet = jest.fn().mockResolvedValue(promDatasource);
      const mockGetInstanceSettingsForLS = jest.fn().mockReturnValue(promSettings);

      jest.spyOn(require('@grafana/runtime'), 'getDataSourceSrv').mockReturnValue({
        get: mockGet,
        getInstanceSettings: mockGetInstanceSettingsForLS,
      });

      // Mock getDashboardSceneFor to return a dashboard with UID
      const mockDashboard = {
        state: { uid: 'test-dashboard-uid' },
      };

      mockGetDashboardSceneFor.mockReturnValue(mockDashboard);

      // Set up queryRunner with NO datasource
      mockQueryRunnerState.datasource = undefined;
      mockQueryRunnerState.queries = [{ refId: 'A' }]; // No datasource property

      const testDataPane = new PanelDataPaneNext({
        panelRef: { resolve: () => mockPanel } as SceneObjectRef<VizPanel>,
      });

      // Call loadDatasource directly (without full activation to avoid other issues)
      await (testDataPane as unknown as { loadDatasource: () => Promise<void> }).loadDatasource();

      // Should check localStorage with dashboard UID
      expect(mockGetLastUsedDatasourceFromStorage).toHaveBeenCalledWith('test-dashboard-uid');

      // Should load the datasource from localStorage
      expect(mockGet).toHaveBeenCalledWith({
        uid: 'stored-prom-uid',
        type: 'prometheus',
      });

      // Should update state with loaded datasource
      expect(testDataPane.state.datasource).toBe(promDatasource);
      expect(testDataPane.state.dsSettings).toBe(promSettings);

      // Should update queryRunner with datasource
      expect(mockQueryRunner.setState).toHaveBeenCalledWith({
        datasource: expect.objectContaining({
          uid: 'stored-prom-uid',
        }),
      });

      // Should store datasource in localStorage
      expect(mockStoreLastUsedDataSourceInLocalStorage).toHaveBeenCalled();
    });
  });
});
