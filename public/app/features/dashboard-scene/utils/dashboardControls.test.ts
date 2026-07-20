import { type DataQuery, type DataSourceApi, type DataSourceJsonData } from '@grafana/data';
import { type DataSourceSrv, getDataSourceSrv } from '@grafana/runtime';
import { type DashboardLink, type DataSourceRef } from '@grafana/schema';
import {
  defaultDataQueryKind,
  type QueryVariableKind,
  type VariableKind,
} from '@grafana/schema/apis/dashboard.grafana.app/v2';

import {
  loadDefaultControlsShared$,
  loadDefaultLinks$,
  loadDefaultVariables$,
  type DefaultControlEvent,
} from './dashboardControls';

jest.mock('@grafana/runtime', () => {
  const actual = jest.requireActual('@grafana/runtime');
  return {
    ...actual,
    getDataSourceSrv: jest.fn(),
  };
});

jest.mock('../serialization/layoutSerializers/utils', () => ({
  getRuntimePanelDataSource: jest.fn(),
}));

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

describe('dashboardControls', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('loadDefaultControlsShared$', () => {
    it('should complete immediately when refs is empty', (done) => {
      const events: DefaultControlEvent[] = [];

      loadDefaultControlsShared$([]).subscribe({
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

      loadDefaultControlsShared$(refs).subscribe({
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

      loadDefaultControlsShared$(refs).subscribe({
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

      loadDefaultControlsShared$(refs).subscribe({
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
      const subscription = loadDefaultControlsShared$(refs).subscribe({
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

  describe('loadDefaultVariables$', () => {
    it('should accumulate and sort variables by origin.group then name', (done) => {
      const refs: DataSourceRef[] = [
        { uid: 'ds-1', type: 'zulu' },
        { uid: 'ds-2', type: 'alpha' },
      ];

      const mockDs1 = createMockDatasource({
        uid: 'ds-1',
        type: 'zulu',
        getDefaultVariables: () => Promise.resolve([mockVariable2, mockVariable1]),
        getDefaultLinks: undefined,
      });

      const mockDs2 = createMockDatasource({
        uid: 'ds-2',
        type: 'alpha',
        getDefaultVariables: () => Promise.resolve([mockVariable1]),
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

      const emissions: VariableKind[][] = [];
      const shared$ = loadDefaultControlsShared$(refs);

      loadDefaultVariables$(shared$).subscribe({
        next: (vars) => emissions.push(vars),
        complete: () => {
          // The final emission should contain all 3 variables sorted by group then name
          const finalVars = emissions[emissions.length - 1];
          expect(finalVars).toHaveLength(3);

          // alpha group should come before zulu group
          expect(finalVars[0].spec.origin?.group).toBe('alpha');
          expect(finalVars[1].spec.origin?.group).toBe('zulu');
          expect(finalVars[2].spec.origin?.group).toBe('zulu');

          // Within zulu group, var1 should come before var2
          expect(finalVars[1].spec.name).toBe('zulu_var1');
          expect(finalVars[2].spec.name).toBe('zulu_var2');
          done();
        },
      });
    });

    it('should not emit when there are no variable events', (done) => {
      const refs: DataSourceRef[] = [{ uid: 'ds-1', type: 'prometheus' }];

      const mockDs = createMockDatasource({
        uid: 'ds-1',
        type: 'prometheus',
        getDefaultVariables: undefined,
        getDefaultLinks: () => Promise.resolve([mockLink1]),
      });

      const mockSrv = createMockDataSourceSrv({
        get: jest.fn(() => Promise.resolve(mockDs as DataSourceApi<DataQuery, DataSourceJsonData>)),
      });

      getDataSourceSrvMock.mockReturnValue(mockSrv);

      const emissions: VariableKind[][] = [];
      const shared$ = loadDefaultControlsShared$(refs);

      loadDefaultVariables$(shared$).subscribe({
        next: (vars) => emissions.push(vars),
        complete: () => {
          expect(emissions).toHaveLength(0);
          done();
        },
      });
    });
  });

  describe('loadDefaultLinks$', () => {
    it('should accumulate and sort links by origin.group then title', (done) => {
      const refs: DataSourceRef[] = [
        { uid: 'ds-1', type: 'zulu' },
        { uid: 'ds-2', type: 'alpha' },
      ];

      const mockLink2: DashboardLink = {
        ...mockLink1,
        title: 'Alpha Link',
      };

      const mockDs1 = createMockDatasource({
        uid: 'ds-1',
        type: 'zulu',
        getDefaultVariables: undefined,
        getDefaultLinks: () => Promise.resolve([mockLink1]),
      });

      const mockDs2 = createMockDatasource({
        uid: 'ds-2',
        type: 'alpha',
        getDefaultVariables: undefined,
        getDefaultLinks: () => Promise.resolve([mockLink2]),
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

      const emissions: DashboardLink[][] = [];
      const shared$ = loadDefaultControlsShared$(refs);

      loadDefaultLinks$(shared$).subscribe({
        next: (links) => emissions.push(links),
        complete: () => {
          const finalLinks = emissions[emissions.length - 1];
          expect(finalLinks).toHaveLength(2);

          // alpha group should come before zulu group
          expect(finalLinks[0].origin?.group).toBe('alpha');
          expect(finalLinks[1].origin?.group).toBe('zulu');
          done();
        },
      });
    });

    it('should not emit when there are no link events', (done) => {
      const refs: DataSourceRef[] = [{ uid: 'ds-1', type: 'prometheus' }];

      const mockDs = createMockDatasource({
        uid: 'ds-1',
        type: 'prometheus',
        getDefaultVariables: () => Promise.resolve([mockVariable1]),
        getDefaultLinks: undefined,
      });

      const mockSrv = createMockDataSourceSrv({
        get: jest.fn(() => Promise.resolve(mockDs as DataSourceApi<DataQuery, DataSourceJsonData>)),
      });

      getDataSourceSrvMock.mockReturnValue(mockSrv);

      const emissions: DashboardLink[][] = [];
      const shared$ = loadDefaultControlsShared$(refs);

      loadDefaultLinks$(shared$).subscribe({
        next: (links) => emissions.push(links),
        complete: () => {
          expect(emissions).toHaveLength(0);
          done();
        },
      });
    });
  });
});
