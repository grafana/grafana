import { DataQuery, DataSourceApi, DataSourceJsonData } from '@grafana/data';
import { DataSourceSrv, getDataSourceSrv, reportInteraction } from '@grafana/runtime';
import { DashboardLink, DataSourceRef } from '@grafana/schema';
import { defaultDataQueryKind, QueryVariableKind } from '@grafana/schema/apis/dashboard.grafana.app/v2';
import { reportPerformance } from 'app/core/services/echo/EchoSrv';

import { DefaultControlEvent, loadDefaultControls$, loadDefaultControlsFromDatasources } from './dashboardControls';

jest.mock('@grafana/runtime', () => {
  const actual = jest.requireActual('@grafana/runtime');
  return {
    ...actual,
    getDataSourceSrv: jest.fn(),
    reportInteraction: jest.fn(),
  };
});

jest.mock('app/core/services/echo/EchoSrv', () => ({
  reportPerformance: jest.fn(),
}));

jest.mock('nanoid', () => ({
  nanoid: jest.fn(() => 'mock-trace-id'),
}));

jest.mock('../serialization/layoutSerializers/utils', () => ({
  getRuntimePanelDataSource: jest.fn(),
}));

const reportInteractionMock = reportInteraction as jest.MockedFunction<typeof reportInteraction>;
const reportPerformanceMock = reportPerformance as jest.MockedFunction<typeof reportPerformance>;

const getDataSourceSrvMock = getDataSourceSrv as jest.MockedFunction<typeof getDataSourceSrv>;

const createMockDataSourceSrv = (overrides: Partial<DataSourceSrv> = {}): DataSourceSrv => ({
  get: jest.fn(),
  getList: jest.fn(),
  getInstanceSettings: jest.fn(),
  reload: jest.fn(),
  registerRuntimeDataSource: jest.fn(),
  ...overrides,
});

// Helper to create a mock datasource instance
const createMockDatasource = (
  overrides: Partial<DataSourceApi<DataQuery, DataSourceJsonData>> = {}
): DataSourceApi<DataQuery, DataSourceJsonData> =>
  ({
    uid: 'test-ds-uid',
    name: 'Test Datasource',
    type: 'test',
    id: 1,
    meta: { id: 'test', name: 'Test', info: { logos: {} } },
    query: jest.fn(),
    testDatasource: jest.fn(),
    getRef: jest.fn(() => ({ uid: 'test-ds-uid', type: 'test' })),
    getDefaultVariables: undefined,
    getDefaultLinks: undefined,
    ...overrides,
  }) as DataSourceApi<DataQuery, DataSourceJsonData>;

// Sample mock variables for reuse across tests
const mockVariable1: QueryVariableKind = {
  kind: 'QueryVariable',
  spec: {
    name: 'var1',
    hide: 'dontHide',
    label: 'Variable 1',
    skipUrlSync: false,
    current: { selected: false, text: 'value1', value: 'value1' },
    options: [],
    query: defaultDataQueryKind(),
    definition: '',
    sort: 'disabled',
    regex: '',
    refresh: 'onTimeRangeChanged',
    multi: false,
    includeAll: false,
    allowCustomValue: false,
  },
};

const mockVariable2: QueryVariableKind = {
  kind: 'QueryVariable',
  spec: {
    name: 'var2',
    hide: 'dontHide',
    label: 'Variable 2',
    skipUrlSync: false,
    current: { selected: false, text: 'value2', value: 'value2' },
    options: [],
    query: defaultDataQueryKind(),
    definition: '',
    sort: 'disabled',
    regex: '',
    refresh: 'onTimeRangeChanged',
    multi: false,
    includeAll: false,
    allowCustomValue: false,
  },
};

// Sample mock links for reuse across tests
const mockLink1: DashboardLink = {
  title: 'Link 1',
  url: 'https://example.com',
  type: 'link',
  icon: 'external',
  tooltip: 'Tooltip 1',
  asDropdown: false,
  tags: [],
  targetBlank: false,
  includeVars: false,
  keepTime: false,
};

const mockLink2: DashboardLink = {
  title: 'Link 2',
  url: 'https://example2.com',
  type: 'link',
  icon: 'external',
  tooltip: 'Tooltip 2',
  asDropdown: false,
  tags: [],
  targetBlank: false,
  includeVars: false,
  keepTime: false,
};

describe('dashboardControls', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('loadDefaultControlsFromDatasources', () => {
    it('should return empty arrays and not track when refs is empty', async () => {
      reportInteractionMock.mockClear();

      const result = await loadDefaultControlsFromDatasources([]);

      expect(result).toEqual({ defaultVariables: [], defaultLinks: [] });
      expect(reportInteractionMock).not.toHaveBeenCalled();
    });

    it('should return empty arrays when datasources have no default controls', async () => {
      const refs: DataSourceRef[] = [{ uid: 'ds-1', type: 'prometheus' }];

      const mockDs = createMockDatasource({
        uid: 'ds-1',
        type: 'prometheus',
        getDefaultVariables: undefined,
        getDefaultLinks: undefined,
      });

      const mockSrv = createMockDataSourceSrv({
        get: jest.fn(() => Promise.resolve(mockDs as DataSourceApi<DataQuery, DataSourceJsonData>)),
      });

      getDataSourceSrvMock.mockReturnValue(mockSrv);

      const result = await loadDefaultControlsFromDatasources(refs);

      expect(result.defaultVariables).toEqual([]);
      expect(result.defaultLinks).toEqual([]);
    });

    it('should collect default variables from datasources', async () => {
      const refs: DataSourceRef[] = [
        { uid: 'ds-1', type: 'prometheus' },
        { uid: 'ds-2', type: 'loki' },
      ];

      const mockDs1 = createMockDatasource({
        uid: 'ds-1',
        type: 'prometheus',
        getDefaultVariables: () => Promise.resolve([mockVariable1]),
        getDefaultLinks: undefined,
        getRef: jest.fn(() => ({ uid: 'ds-1', type: 'prometheus' })),
      });

      const mockDs2 = createMockDatasource({
        uid: 'ds-2',
        type: 'loki',
        getDefaultVariables: () => Promise.resolve([mockVariable2]),
        getDefaultLinks: undefined,
        getRef: jest.fn(() => ({ uid: 'ds-2', type: 'loki' })),
      });

      const mockSrv = createMockDataSourceSrv({
        get: jest.fn((ref) => {
          if (ref && typeof ref === 'object' && 'uid' in ref && ref.uid === 'ds-1') {
            return Promise.resolve(mockDs1);
          }
          if (ref && typeof ref === 'object' && 'uid' in ref && ref.uid === 'ds-2') {
            return Promise.resolve(mockDs2);
          }
          return Promise.reject(new Error('Unknown datasource'));
        }),
      });

      getDataSourceSrvMock.mockReturnValue(mockSrv);

      const result = await loadDefaultControlsFromDatasources(refs);

      expect(result.defaultVariables).toHaveLength(2);
      expect(result.defaultVariables[0]).toMatchObject({
        ...mockVariable1,
        spec: {
          ...mockVariable1.spec,
          origin: {
            type: 'datasource',
            group: 'prometheus',
          },
        },
      });
      expect(result.defaultVariables[1]).toMatchObject({
        ...mockVariable2,
        spec: {
          ...mockVariable2.spec,
          origin: {
            type: 'datasource',
            group: 'loki',
          },
        },
      });
      expect(result.defaultLinks).toEqual([]);
    });

    it('should collect default links from datasources', async () => {
      const refs: DataSourceRef[] = [{ uid: 'ds-1', type: 'prometheus' }];

      const mockDs = createMockDatasource({
        uid: 'ds-1',
        type: 'prometheus',
        getDefaultVariables: undefined,
        getDefaultLinks: () => Promise.resolve([mockLink1, mockLink2]),
        getRef: jest.fn(() => ({ uid: 'ds-1', type: 'prometheus' })),
      });

      const mockSrv = createMockDataSourceSrv({
        get: jest.fn(() => Promise.resolve(mockDs as DataSourceApi<DataQuery, DataSourceJsonData>)),
      });

      getDataSourceSrvMock.mockReturnValue(mockSrv);

      const result = await loadDefaultControlsFromDatasources(refs);

      expect(result.defaultVariables).toEqual([]);
      expect(result.defaultLinks).toHaveLength(2);
      expect(result.defaultLinks[0]).toMatchObject({
        ...mockLink1,
        origin: {
          type: 'datasource',
          group: 'prometheus',
        },
      });
      expect(result.defaultLinks[1]).toMatchObject({
        ...mockLink2,
        origin: {
          type: 'datasource',
          group: 'prometheus',
        },
      });
    });

    it('should handle datasources with both variables and links', async () => {
      const refs: DataSourceRef[] = [{ uid: 'ds-1', type: 'prometheus' }];

      const mockDs = createMockDatasource({
        uid: 'ds-1',
        type: 'prometheus',
        getDefaultVariables: () => Promise.resolve([mockVariable1]),
        getDefaultLinks: () => Promise.resolve([mockLink1]),
        getRef: jest.fn(() => ({ uid: 'ds-1', type: 'prometheus' })),
      });

      const mockSrv = createMockDataSourceSrv({
        get: jest.fn(() => Promise.resolve(mockDs as DataSourceApi<DataQuery, DataSourceJsonData>)),
      });

      getDataSourceSrvMock.mockReturnValue(mockSrv);

      const result = await loadDefaultControlsFromDatasources(refs);

      expect(result.defaultVariables).toHaveLength(1);
      expect(result.defaultLinks).toHaveLength(1);
    });

    it('should handle datasources that return null or undefined from getDefaultVariables', async () => {
      const refs: DataSourceRef[] = [{ uid: 'ds-1', type: 'prometheus' }];

      const mockDs = createMockDatasource({
        uid: 'ds-1',
        type: 'prometheus',
        getDefaultVariables: undefined,
        getDefaultLinks: undefined,
      });

      const mockSrv = createMockDataSourceSrv({
        get: jest.fn(() => Promise.resolve(mockDs as DataSourceApi<DataQuery, DataSourceJsonData>)),
      });

      getDataSourceSrvMock.mockReturnValue(mockSrv);

      const result = await loadDefaultControlsFromDatasources(refs);

      expect(result.defaultVariables).toEqual([]);
      expect(result.defaultLinks).toEqual([]);
    });

    describe('tracking', () => {
      it('should report interaction events with same traceId and correct event name', async () => {
        const refs: DataSourceRef[] = [{ uid: 'ds-1', type: 'prometheus' }];
        const mockDs = createMockDatasource({
          uid: 'ds-1',
          type: 'prometheus',
          getDefaultVariables: undefined,
          getDefaultLinks: undefined,
        });
        const mockSrv = createMockDataSourceSrv({
          get: jest.fn(() => Promise.resolve(mockDs as DataSourceApi<DataQuery, DataSourceJsonData>)),
        });
        getDataSourceSrvMock.mockReturnValue(mockSrv);
        reportInteractionMock.mockClear();
        reportPerformanceMock.mockClear();

        await loadDefaultControlsFromDatasources(refs);

        expect(reportInteractionMock).toHaveBeenCalledWith(
          'dashboards_load_default_controls',
          expect.objectContaining({
            traceId: 'mock-trace-id',
            phase: 'load_datasources',
            duration_ms: expect.any(Number),
          })
        );
        expect(reportInteractionMock).toHaveBeenCalledWith(
          'dashboards_load_default_controls',
          expect.objectContaining({
            traceId: 'mock-trace-id',
            phase: 'total',
            duration_ms: expect.any(Number),
          })
        );
        const traceIds = reportInteractionMock.mock.calls.map((c) => c[1]?.traceId);
        expect(traceIds.every((id) => id === 'mock-trace-id')).toBe(true);
      });

      it('should report exactly one performance event with total duration', async () => {
        const refs: DataSourceRef[] = [{ uid: 'ds-1', type: 'prometheus' }];
        const mockDs = createMockDatasource({
          uid: 'ds-1',
          type: 'prometheus',
          getDefaultVariables: undefined,
          getDefaultLinks: undefined,
        });
        const mockSrv = createMockDataSourceSrv({
          get: jest.fn(() => Promise.resolve(mockDs as DataSourceApi<DataQuery, DataSourceJsonData>)),
        });
        getDataSourceSrvMock.mockReturnValue(mockSrv);
        reportPerformanceMock.mockClear();

        await loadDefaultControlsFromDatasources(refs);

        expect(reportPerformanceMock).toHaveBeenCalledTimes(1);
        expect(reportPerformanceMock).toHaveBeenCalledWith(
          'dashboards_default_controls_load_total_ms',
          expect.any(Number)
        );
      });

      it('should report get_default_variables and get_default_links with datasourceType when datasource has both', async () => {
        const refs: DataSourceRef[] = [{ uid: 'ds-1', type: 'prometheus' }];
        const mockDs = createMockDatasource({
          uid: 'ds-1',
          type: 'prometheus',
          getDefaultVariables: () => Promise.resolve([mockVariable1]),
          getDefaultLinks: () => Promise.resolve([mockLink1]),
          getRef: jest.fn(() => ({ uid: 'ds-1', type: 'prometheus' })),
        });
        const mockSrv = createMockDataSourceSrv({
          get: jest.fn(() => Promise.resolve(mockDs as DataSourceApi<DataQuery, DataSourceJsonData>)),
        });
        getDataSourceSrvMock.mockReturnValue(mockSrv);
        reportInteractionMock.mockClear();

        await loadDefaultControlsFromDatasources(refs);

        expect(reportInteractionMock).toHaveBeenCalledWith(
          'dashboards_load_default_controls',
          expect.objectContaining({
            traceId: 'mock-trace-id',
            phase: 'default_variables',
            duration_ms: expect.any(Number),
            datasourceType: 'prometheus',
          })
        );
        expect(reportInteractionMock).toHaveBeenCalledWith(
          'dashboards_load_default_controls',
          expect.objectContaining({
            traceId: 'mock-trace-id',
            phase: 'default_links',
            duration_ms: expect.any(Number),
            datasourceType: 'prometheus',
          })
        );
      });
    });
  });

  describe('loadDefaultControls$', () => {
    it('should complete immediately when refs is empty', (done) => {
      const events: DefaultControlEvent[] = [];

      loadDefaultControls$([]).subscribe({
        next: (event) => events.push(event),
        complete: () => {
          expect(events).toEqual([]);
          done();
        },
      });
    });

    it('should emit variables and links per-datasource and then complete', (done) => {
      const refs: DataSourceRef[] = [
        { uid: 'ds-1', type: 'prometheus' },
        { uid: 'ds-2', type: 'loki' },
      ];

      const mockDs1 = createMockDatasource({
        uid: 'ds-1',
        type: 'prometheus',
        getDefaultVariables: () => Promise.resolve([mockVariable1]),
        getDefaultLinks: () => Promise.resolve([mockLink1]),
      });

      const mockDs2 = createMockDatasource({
        uid: 'ds-2',
        type: 'loki',
        getDefaultVariables: () => Promise.resolve([mockVariable2]),
        getDefaultLinks: undefined,
      });

      const mockSrv = createMockDataSourceSrv({
        get: jest.fn((ref) => {
          if (ref && typeof ref === 'object' && 'uid' in ref && ref.uid === 'ds-1') {
            return Promise.resolve(mockDs1);
          }
          return Promise.resolve(mockDs2);
        }),
      });

      getDataSourceSrvMock.mockReturnValue(mockSrv);

      const events: DefaultControlEvent[] = [];

      loadDefaultControls$(refs).subscribe({
        next: (event) => events.push(event),
        complete: () => {
          const variableEvents = events.filter((e) => e.type === 'variables');
          const linkEvents = events.filter((e) => e.type === 'links');

          expect(variableEvents).toHaveLength(2);
          expect(linkEvents).toHaveLength(1);
          done();
        },
      });
    });

    it('should continue emitting from other datasources when one fails to load', (done) => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
      const refs: DataSourceRef[] = [
        { uid: 'ds-fail', type: 'broken' },
        { uid: 'ds-ok', type: 'prometheus' },
      ];

      const mockDs = createMockDatasource({
        uid: 'ds-ok',
        type: 'prometheus',
        getDefaultVariables: () => Promise.resolve([mockVariable1]),
        getDefaultLinks: undefined,
      });

      const mockSrv = createMockDataSourceSrv({
        get: jest.fn((ref) => {
          if (ref && typeof ref === 'object' && 'uid' in ref && ref.uid === 'ds-fail') {
            return Promise.reject(new Error('Datasource not found'));
          }
          return Promise.resolve(mockDs);
        }),
      });

      getDataSourceSrvMock.mockReturnValue(mockSrv);

      const events: DefaultControlEvent[] = [];

      loadDefaultControls$(refs).subscribe({
        next: (event) => events.push(event),
        complete: () => {
          expect(events).toHaveLength(1);
          expect(events[0].type).toBe('variables');
          warnSpy.mockRestore();
          done();
        },
      });
    });

    it('should continue emitting links when getDefaultVariables throws', (done) => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
      const refs: DataSourceRef[] = [{ uid: 'ds-1', type: 'prometheus' }];

      const mockDs = createMockDatasource({
        uid: 'ds-1',
        type: 'prometheus',
        getDefaultVariables: () => Promise.reject(new Error('variables error')),
        getDefaultLinks: () => Promise.resolve([mockLink1]),
      });

      const mockSrv = createMockDataSourceSrv({
        get: jest.fn(() => Promise.resolve(mockDs as DataSourceApi<DataQuery, DataSourceJsonData>)),
      });

      getDataSourceSrvMock.mockReturnValue(mockSrv);

      const events: DefaultControlEvent[] = [];

      loadDefaultControls$(refs).subscribe({
        next: (event) => events.push(event),
        complete: () => {
          expect(events).toHaveLength(1);
          expect(events[0].type).toBe('links');
          warnSpy.mockRestore();
          done();
        },
      });
    });

    it('should stop emitting when unsubscribed', () => {
      const refs: DataSourceRef[] = [{ uid: 'ds-1', type: 'prometheus' }];

      // Use a deferred promise so we can control when the datasource resolves
      let resolveDs: (ds: DataSourceApi) => void;
      const dsPromise = new Promise<DataSourceApi>((resolve) => {
        resolveDs = resolve;
      });

      const mockSrv = createMockDataSourceSrv({
        get: jest.fn(() => dsPromise),
      });

      getDataSourceSrvMock.mockReturnValue(mockSrv);

      const events: DefaultControlEvent[] = [];
      const subscription = loadDefaultControls$(refs).subscribe({
        next: (event) => events.push(event),
      });

      // Unsubscribe before the datasource resolves
      subscription.unsubscribe();

      // Resolve the datasource after unsubscription
      const mockDs = createMockDatasource({
        uid: 'ds-1',
        type: 'prometheus',
        getDefaultVariables: () => Promise.resolve([mockVariable1]),
      });
      resolveDs!(mockDs);

      // No events should have been emitted
      expect(events).toEqual([]);
    });
  });
});
