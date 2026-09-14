import {
  type DataQuery,
  type DataSourceApi,
  type DataSourceInstanceSettings,
  type DataSourceJsonData,
} from '@grafana/data';
import { getDataSourceInstance, getDataSourceInstanceSettings } from '@grafana/runtime/unstable';
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

jest.mock('@grafana/runtime/unstable', () => ({
  ...jest.requireActual('@grafana/runtime/unstable'),
  getDataSourceInstance: jest.fn(),
  getDataSourceInstanceSettings: jest.fn(),
}));

jest.mock('../serialization/layoutSerializers/utils', () => ({
  getRuntimePanelDataSource: jest.fn(),
}));

const getDataSourceInstanceMock = jest.mocked(getDataSourceInstance);
const getDataSourceInstanceSettingsMock = jest.mocked(getDataSourceInstanceSettings);

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
    getDataSourceInstanceSettingsMock.mockResolvedValue({ uid: 'test-ds-uid' } as DataSourceInstanceSettings);
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

      getDataSourceInstanceMock.mockImplementation(async (ref) => {
        if (ref && typeof ref === 'object' && 'uid' in ref && ref.uid === 'ds-1') {
          return mockDs1;
        }
        return mockDs2;
      });

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

    it('should skip a missing datasource without warning and still emit from others', (done) => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
      const missingRef: DataSourceRef = { uid: 'ds-missing', type: 'broken' };
      const okRef: DataSourceRef = { uid: 'ds-ok', type: 'prometheus' };

      const mockDs = createMockDatasource({
        uid: 'ds-ok',
        type: 'prometheus',
        getDefaultVariables: () => Promise.resolve([mockVariable1]),
        getDefaultLinks: undefined,
      });

      getDataSourceInstanceSettingsMock.mockImplementation(async (ref) => {
        if (ref && typeof ref === 'object' && 'uid' in ref && ref.uid === missingRef.uid) {
          return undefined;
        }
        return { uid: 'ds-ok' } as DataSourceInstanceSettings;
      });
      getDataSourceInstanceMock.mockResolvedValue(mockDs);

      const events: DefaultControlEvent[] = [];

      loadDefaultControlsShared$([missingRef, okRef]).subscribe({
        next: (event) => events.push(event),
        complete: () => {
          expect(events).toHaveLength(1);
          expect(events[0].type).toBe('variables');
          expect(getDataSourceInstanceMock).toHaveBeenCalledTimes(1);
          expect(getDataSourceInstanceMock).toHaveBeenCalledWith(okRef);
          expect(warnSpy).not.toHaveBeenCalled();
          warnSpy.mockRestore();
          done();
        },
      });
    });

    it('should load default controls for a type-only ref with an empty uid', (done) => {
      const emptyUidRef: DataSourceRef = { uid: '', type: 'prometheus' };

      const mockDs = createMockDatasource({
        uid: 'prom-uid',
        type: 'prometheus',
        getDefaultVariables: () => Promise.resolve([mockVariable1]),
        getDefaultLinks: undefined,
      });

      getDataSourceInstanceSettingsMock.mockImplementation(async (ref) => {
        if (ref && typeof ref === 'object' && ref.uid === '') {
          return undefined;
        }
        return { uid: 'prom-uid', type: 'prometheus' } as DataSourceInstanceSettings;
      });
      getDataSourceInstanceMock.mockResolvedValue(mockDs);

      const events: DefaultControlEvent[] = [];

      loadDefaultControlsShared$([emptyUidRef]).subscribe({
        next: (event) => events.push(event),
        complete: () => {
          expect(getDataSourceInstanceSettingsMock).toHaveBeenCalledWith({ uid: undefined, type: 'prometheus' });
          expect(getDataSourceInstanceMock).toHaveBeenCalledWith(emptyUidRef);
          expect(events).toHaveLength(1);
          expect(events[0].type).toBe('variables');
          done();
        },
      });
    });

    it('should skip a type-only ref that falls back to a different datasource type', (done) => {
      // getDsRefsFromScene emits { type: pluginId } (no uid) for every DataSourceVariable.
      // When that plugin has no installed instance, getDataSourceInstanceSettings falls
      // back to the default datasource — the same contract as legacy getInstanceSettings,
      // but not as legacy get(), which rejected. Skip so the default DS's controls are
      // not emitted under the variable's pluginId.
      const typeOnlyRef: DataSourceRef = { type: 'someuninstalledplugin' };

      getDataSourceInstanceSettingsMock.mockResolvedValue({
        uid: 'default-uid',
        type: 'prometheus',
      } as DataSourceInstanceSettings);

      const defaultDs = createMockDatasource({
        uid: 'default-uid',
        type: 'prometheus',
        getDefaultVariables: () => Promise.resolve([mockVariable1]),
        getDefaultLinks: undefined,
      });
      getDataSourceInstanceMock.mockResolvedValue(defaultDs);

      const events: DefaultControlEvent[] = [];

      loadDefaultControlsShared$([typeOnlyRef]).subscribe({
        next: (event) => events.push(event),
        complete: () => {
          expect(events).toEqual([]);
          expect(getDataSourceInstanceMock).not.toHaveBeenCalled();
          done();
        },
      });
    });

    it('should load default controls when a type-only ref resolves via plugin aliasIDs', (done) => {
      // DataSourceVariable refs use pluginId, which may still be a legacy id (testdata).
      // getDataSourceInstanceSettings resolves that through meta.aliasIDs to a real
      // instance whose settings.type is the current plugin id. That is not a default-DS
      // fallback and must not be skipped.
      const typeOnlyRef: DataSourceRef = { type: 'testdata' };

      getDataSourceInstanceSettingsMock.mockResolvedValue({
        uid: 'testdata-uid',
        type: 'grafana-testdata-datasource',
        meta: { id: 'grafana-testdata-datasource', aliasIDs: ['testdata'] },
      } as DataSourceInstanceSettings);

      const mockDs = createMockDatasource({
        uid: 'testdata-uid',
        type: 'grafana-testdata-datasource',
        getDefaultVariables: () => Promise.resolve([mockVariable1]),
        getDefaultLinks: undefined,
      });
      getDataSourceInstanceMock.mockResolvedValue(mockDs);

      const events: DefaultControlEvent[] = [];

      loadDefaultControlsShared$([typeOnlyRef]).subscribe({
        next: (event) => events.push(event),
        complete: () => {
          expect(getDataSourceInstanceMock).toHaveBeenCalledWith(typeOnlyRef);
          expect(events).toHaveLength(1);
          expect(events[0].type).toBe('variables');
          done();
        },
      });
    });

    it('should warn when a registered datasource fails to load, even if the error mentions not found', (done) => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
      const refs: DataSourceRef[] = [{ uid: 'ds-fail', type: 'broken' }];
      const loadError = new Error('Loading chunk 42 failed (404 Not Found)');

      getDataSourceInstanceMock.mockRejectedValue(loadError);

      loadDefaultControlsShared$(refs).subscribe({
        complete: () => {
          expect(warnSpy).toHaveBeenCalledWith('Failed to load datasource', refs[0], loadError);
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

      getDataSourceInstanceMock.mockResolvedValue(mockDs);

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

      getDataSourceInstanceMock.mockReturnValue(dsPromise);

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

      getDataSourceInstanceMock.mockImplementation(async (ref) => {
        if (ref && typeof ref === 'object' && 'uid' in ref && ref.uid === 'ds-1') {
          return mockDs1;
        }
        return mockDs2;
      });

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

      getDataSourceInstanceMock.mockResolvedValue(mockDs);

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

      getDataSourceInstanceMock.mockImplementation(async (ref) => {
        if (ref && typeof ref === 'object' && 'uid' in ref && ref.uid === 'ds-1') {
          return mockDs1;
        }
        return mockDs2;
      });

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

      getDataSourceInstanceMock.mockResolvedValue(mockDs);

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
