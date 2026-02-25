import { DataQuery, DataSourceApi, DataSourceJsonData } from '@grafana/data';
import { DataSourceSrv, getDataSourceSrv, reportInteraction } from '@grafana/runtime';
import { DashboardLink, DataSourceRef } from '@grafana/schema';
import {
  Spec as DashboardV2Spec,
  defaultDataQueryKind,
  defaultVizConfigSpec,
  defaultSpec as defaultDashboardV2Spec,
  QueryVariableKind,
} from '@grafana/schema/apis/dashboard.grafana.app/v2';
import { reportPerformance } from 'app/core/services/echo/EchoSrv';
import { DashboardWithAccessInfo } from 'app/features/dashboard/api/types';
import { DashboardDTO } from 'app/types/dashboard';

import { getRuntimePanelDataSource } from '../serialization/layoutSerializers/utils';

import {
  getDsRefsFromV1Dashboard,
  getDsRefsFromV2Dashboard,
  loadDefaultControlsFromDatasources,
} from './dashboardControls';

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
const getRuntimePanelDataSourceMock = getRuntimePanelDataSource as jest.MockedFunction<
  typeof getRuntimePanelDataSource
>;

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

  describe('getDsRefsFromV1Dashboard', () => {
    it('should extract datasource refs from panels', () => {
      const dashboardDTO: DashboardDTO = {
        dashboard: {
          id: 1,
          uid: 'test-dashboard-uid',
          title: 'Test Dashboard',
          tags: [],
          timezone: 'browser',
          panels: [
            {
              id: 1,
              type: 'graph',
              datasource: { uid: 'ds-1', type: 'prometheus' },
              gridPos: { x: 0, y: 0, w: 12, h: 8 },
            },
            {
              id: 2,
              type: 'graph',
              datasource: { uid: 'ds-2', type: 'loki' },
              gridPos: { x: 12, y: 0, w: 12, h: 8 },
            },
            {
              id: 3,
              type: 'row',
              gridPos: { x: 0, y: 8, w: 24, h: 1 },
            },
          ],
          time: { from: 'now-6h', to: 'now' },
          timepicker: {},
          templating: { list: [] },
          annotations: { list: [] },
          refresh: '',
          schemaVersion: 30,
          version: 1,
          links: [],
        },
        meta: {
          slug: 'test-dashboard',
          url: '/d/test-dashboard',
          canSave: true,
          canEdit: true,
          canAdmin: true,
          canDelete: true,
          canStar: true,
          expires: '',
          created: '',
          updated: '',
          updatedBy: '',
          createdBy: '',
          version: 1,
          isFolder: false,
          folderId: 0,
          folderTitle: '',
          folderUrl: '',
          provisioned: false,
          provisionedExternalId: '',
          annotationsPermissions: {
            dashboard: { canAdd: false, canEdit: false, canDelete: false },
            organization: { canAdd: false, canEdit: false, canDelete: false },
          },
          publicDashboardEnabled: false,
        },
      };

      const result = getDsRefsFromV1Dashboard(dashboardDTO);

      expect(result).toHaveLength(2);
      expect(result).toEqual([
        { uid: 'ds-1', type: 'prometheus' },
        { uid: 'ds-2', type: 'loki' },
      ]);
    });

    it('should extract datasource refs from panel targets when panel datasource is missing', () => {
      const dashboardDTO: DashboardDTO = {
        dashboard: {
          id: 1,
          uid: 'test-dashboard-uid',
          title: 'Test Dashboard',
          tags: [],
          timezone: 'browser',
          panels: [
            {
              id: 1,
              type: 'graph',
              gridPos: { x: 0, y: 0, w: 12, h: 8 },
              targets: [
                {
                  datasource: { uid: 'ds-1', type: 'prometheus' },
                  refId: 'A',
                },
              ],
            },
          ],
          time: { from: 'now-6h', to: 'now' },
          timepicker: {},
          templating: { list: [] },
          annotations: { list: [] },
          refresh: '',
          schemaVersion: 30,
          version: 1,
          links: [],
        },
        meta: {
          slug: 'test-dashboard',
          url: '/d/test-dashboard',
          canSave: true,
          canEdit: true,
          canAdmin: true,
          canDelete: true,
          canStar: true,
          expires: '',
          created: '',
          updated: '',
          updatedBy: '',
          createdBy: '',
          version: 1,
          isFolder: false,
          folderId: 0,
          folderTitle: '',
          folderUrl: '',
          provisioned: false,
          provisionedExternalId: '',
          annotationsPermissions: {
            dashboard: { canAdd: false, canEdit: false, canDelete: false },
            organization: { canAdd: false, canEdit: false, canDelete: false },
          },
          publicDashboardEnabled: false,
        },
      };

      const result = getDsRefsFromV1Dashboard(dashboardDTO);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ uid: 'ds-1', type: 'prometheus' });
    });

    it('should extract datasource refs from query variables', () => {
      const dashboardDTO: DashboardDTO = {
        dashboard: {
          id: 1,
          uid: 'test-dashboard-uid',
          title: 'Test Dashboard',
          tags: [],
          timezone: 'browser',
          panels: [],
          time: { from: 'now-6h', to: 'now' },
          timepicker: {},
          templating: {
            list: [
              {
                name: 'queryVar',
                type: 'query',
                datasource: { uid: 'ds-1', type: 'prometheus' },
                current: { selected: false, text: '', value: '' },
                options: [],
                query: '',
                description: undefined,
                hide: 0,
                label: '',
                skipUrlSync: false,
              },
            ],
          },
          annotations: { list: [] },
          refresh: '',
          schemaVersion: 30,
          version: 1,
          links: [],
        },
        meta: {
          slug: 'test-dashboard',
          url: '/d/test-dashboard',
          canSave: true,
          canEdit: true,
          canAdmin: true,
          canDelete: true,
          canStar: true,
          expires: '',
          created: '',
          updated: '',
          updatedBy: '',
          createdBy: '',
          version: 1,
          isFolder: false,
          folderId: 0,
          folderTitle: '',
          folderUrl: '',
          provisioned: false,
          provisionedExternalId: '',
          annotationsPermissions: {
            dashboard: { canAdd: false, canEdit: false, canDelete: false },
            organization: { canAdd: false, canEdit: false, canDelete: false },
          },
          publicDashboardEnabled: false,
        },
      };

      const result = getDsRefsFromV1Dashboard(dashboardDTO);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ uid: 'ds-1', type: 'prometheus' });
    });

    it('should extract datasource refs from datasource variables', () => {
      const dashboardDTO: DashboardDTO = {
        dashboard: {
          id: 1,
          uid: 'test-dashboard-uid',
          title: 'Test Dashboard',
          tags: [],
          timezone: 'browser',
          panels: [],
          time: { from: 'now-6h', to: 'now' },
          timepicker: {},
          templating: {
            list: [
              {
                name: 'dsVar',
                type: 'datasource',
                query: 'prometheus',
                current: { selected: false, text: '', value: '' },
                options: [],
                description: undefined,
                hide: 0,
                label: '',
                skipUrlSync: false,
              },
            ],
          },
          annotations: { list: [] },
          refresh: '',
          schemaVersion: 30,
          version: 1,
          links: [],
        },
        meta: {
          slug: 'test-dashboard',
          url: '/d/test-dashboard',
          canSave: true,
          canEdit: true,
          canAdmin: true,
          canDelete: true,
          canStar: true,
          expires: '',
          created: '',
          updated: '',
          updatedBy: '',
          createdBy: '',
          version: 1,
          isFolder: false,
          folderId: 0,
          folderTitle: '',
          folderUrl: '',
          provisioned: false,
          provisionedExternalId: '',
          annotationsPermissions: {
            dashboard: { canAdd: false, canEdit: false, canDelete: false },
            organization: { canAdd: false, canEdit: false, canDelete: false },
          },
          publicDashboardEnabled: false,
        },
      };

      const result = getDsRefsFromV1Dashboard(dashboardDTO);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ type: 'prometheus' });
    });

    it('should deduplicate datasource refs by type', () => {
      const dashboardDTO: DashboardDTO = {
        dashboard: {
          id: 1,
          uid: 'test-dashboard-uid',
          title: 'Test Dashboard',
          tags: [],
          timezone: 'browser',
          panels: [
            {
              id: 1,
              type: 'graph',
              datasource: { uid: 'ds-1', type: 'prometheus' },
              gridPos: { x: 0, y: 0, w: 12, h: 8 },
            },
            {
              id: 2,
              type: 'graph',
              datasource: { uid: 'ds-2', type: 'prometheus' },
              gridPos: { x: 12, y: 0, w: 12, h: 8 },
            },
          ],
          time: { from: 'now-6h', to: 'now' },
          timepicker: {},
          templating: { list: [] },
          annotations: { list: [] },
          refresh: '',
          schemaVersion: 30,
          version: 1,
          links: [],
        },
        meta: {
          slug: 'test-dashboard',
          url: '/d/test-dashboard',
          canSave: true,
          canEdit: true,
          canAdmin: true,
          canDelete: true,
          canStar: true,
          expires: '',
          created: '',
          updated: '',
          updatedBy: '',
          createdBy: '',
          version: 1,
          isFolder: false,
          folderId: 0,
          folderTitle: '',
          folderUrl: '',
          provisioned: false,
          provisionedExternalId: '',
          annotationsPermissions: {
            dashboard: { canAdd: false, canEdit: false, canDelete: false },
            organization: { canAdd: false, canEdit: false, canDelete: false },
          },
          publicDashboardEnabled: false,
        },
      };

      const result = getDsRefsFromV1Dashboard(dashboardDTO);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ uid: 'ds-1', type: 'prometheus' });
    });
  });

  describe('getDsRefsFromV2Dashboard', () => {
    it('should extract datasource refs from panel queries', () => {
      const dashboardV2: DashboardWithAccessInfo<DashboardV2Spec> = {
        kind: 'DashboardWithAccessInfo',
        apiVersion: 'dashboard.grafana.app/v0alpha1',
        metadata: {
          name: 'test-dashboard',
          creationTimestamp: '',
          resourceVersion: '1',
        },
        spec: {
          ...defaultDashboardV2Spec(),
          elements: {
            panel1: {
              kind: 'Panel',
              spec: {
                id: 1,
                title: 'Test Panel',
                description: '',
                links: [],
                vizConfig: {
                  kind: 'VizConfig',
                  group: '',
                  version: '1.0.0',
                  spec: defaultVizConfigSpec(),
                },
                data: {
                  kind: 'QueryGroup',
                  spec: {
                    queries: [
                      {
                        kind: 'PanelQuery',
                        spec: {
                          refId: 'A',
                          hidden: false,
                          query: {
                            kind: 'DataQuery',
                            version: defaultDataQueryKind().version,
                            group: 'prometheus',
                            datasource: { name: 'ds-1' },
                            spec: {},
                          },
                        },
                      },
                      {
                        kind: 'PanelQuery',
                        spec: {
                          refId: 'B',
                          hidden: false,
                          query: {
                            kind: 'DataQuery',
                            version: defaultDataQueryKind().version,
                            group: 'loki',
                            datasource: { name: 'ds-2' },
                            spec: {},
                          },
                        },
                      },
                    ],
                    transformations: [],
                    queryOptions: {},
                  },
                },
              },
            },
          },
        },
        access: {
          canEdit: true,
          canSave: true,
          canAdmin: true,
          canDelete: true,
        },
      };

      const result = getDsRefsFromV2Dashboard(dashboardV2);

      expect(result).toHaveLength(2);
      expect(result).toEqual([
        { uid: 'ds-1', type: 'prometheus' },
        { uid: 'ds-2', type: 'loki' },
      ]);
    });

    it('should use getRuntimePanelDataSource when datasource name is missing', () => {
      const dashboardV2: DashboardWithAccessInfo<DashboardV2Spec> = {
        kind: 'DashboardWithAccessInfo',
        apiVersion: 'dashboard.grafana.app/v0alpha1',
        metadata: {
          name: 'test-dashboard',
          creationTimestamp: '',
          resourceVersion: '1',
        },
        spec: {
          ...defaultDashboardV2Spec(),
          elements: {
            panel1: {
              kind: 'Panel',
              spec: {
                id: 1,
                title: 'Test Panel',
                description: '',
                links: [],
                vizConfig: {
                  kind: 'VizConfig',
                  group: '',
                  version: '1.0.0',
                  spec: defaultVizConfigSpec(),
                },
                data: {
                  kind: 'QueryGroup',
                  spec: {
                    queries: [
                      {
                        kind: 'PanelQuery',
                        spec: {
                          refId: 'A',
                          hidden: false,
                          query: {
                            kind: 'DataQuery',
                            version: defaultDataQueryKind().version,
                            group: 'prometheus',
                            spec: {},
                          },
                        },
                      },
                    ],
                    transformations: [],
                    queryOptions: {},
                  },
                },
              },
            },
          },
        },
        access: {
          canEdit: true,
          canSave: true,
          canAdmin: true,
          canDelete: true,
        },
      };

      getRuntimePanelDataSourceMock.mockReturnValue({ uid: 'runtime-ds', type: 'prometheus' } as DataSourceRef);

      const result = getDsRefsFromV2Dashboard(dashboardV2);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ uid: 'runtime-ds', type: 'prometheus' });
      expect(getRuntimePanelDataSourceMock).toHaveBeenCalled();
    });

    it('should extract datasource refs from QueryVariable', () => {
      const dashboardV2: DashboardWithAccessInfo<DashboardV2Spec> = {
        kind: 'DashboardWithAccessInfo',
        apiVersion: 'dashboard.grafana.app/v0alpha1',
        metadata: {
          name: 'test-dashboard',
          creationTimestamp: '',
          resourceVersion: '1',
        },
        spec: {
          ...defaultDashboardV2Spec(),
          elements: {},
          variables: [
            {
              kind: 'QueryVariable',
              spec: {
                name: 'queryVar',
                query: {
                  kind: 'DataQuery',
                  version: 'v0',
                  group: 'prometheus',
                  datasource: { name: 'ds-1' },
                  spec: {},
                },
                current: { selected: false, text: '', value: '' },
                options: [],
                refresh: 'onDashboardLoad',
                regex: '',
                sort: 'alphabeticalAsc',
                multi: false,
                includeAll: false,
                allowCustomValue: false,
                allValue: undefined,
                hide: 'dontHide',
                label: '',
                skipUrlSync: false,
              },
            },
          ],
          title: 'Test Dashboard',
        },
        access: {
          canEdit: true,
          canSave: true,
          canAdmin: true,
          canDelete: true,
        },
      };

      const result = getDsRefsFromV2Dashboard(dashboardV2);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ uid: 'ds-1', type: 'prometheus' });
    });

    it('should extract datasource refs from QueryVariable with only group', () => {
      const dashboardV2: DashboardWithAccessInfo<DashboardV2Spec> = {
        kind: 'DashboardWithAccessInfo',
        apiVersion: 'dashboard.grafana.app/v0alpha1',
        metadata: {
          name: 'test-dashboard',
          creationTimestamp: '',
          resourceVersion: '1',
        },
        spec: {
          ...defaultDashboardV2Spec(),
          elements: {},
          variables: [
            {
              kind: 'QueryVariable',
              spec: {
                name: 'queryVar',
                query: {
                  kind: 'DataQuery',
                  version: 'v0',
                  group: 'prometheus',
                  spec: {},
                },
                current: { selected: false, text: '', value: '' },
                options: [],
                refresh: 'onDashboardLoad',
                regex: '',
                sort: 'alphabeticalAsc',
                multi: false,
                includeAll: false,
                allowCustomValue: false,
                allValue: undefined,
                hide: 'dontHide',
                label: '',
                skipUrlSync: false,
              },
            },
          ],
          title: 'Test Dashboard',
        },
        access: {
          canEdit: true,
          canSave: true,
          canAdmin: true,
          canDelete: true,
        },
      };

      const result = getDsRefsFromV2Dashboard(dashboardV2);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ type: 'prometheus' });
    });

    it('should extract datasource refs from DatasourceVariable', () => {
      const dashboardV2: DashboardWithAccessInfo<DashboardV2Spec> = {
        kind: 'DashboardWithAccessInfo',
        apiVersion: 'dashboard.grafana.app/v0alpha1',
        metadata: {
          name: 'test-dashboard',
          creationTimestamp: '',
          resourceVersion: '1',
        },
        spec: {
          ...defaultDashboardV2Spec(),
          elements: {},
          variables: [
            {
              kind: 'DatasourceVariable',
              spec: {
                name: 'dsVar',
                pluginId: 'prometheus',
                current: { selected: false, text: '', value: '' },
                options: [],
                refresh: 'onDashboardLoad',
                regex: '',
                multi: false,
                includeAll: false,
                allowCustomValue: false,
                allValue: undefined,
                hide: 'dontHide',
                label: '',
                skipUrlSync: false,
              },
            },
          ],
          title: 'Test Dashboard',
        },
        access: {
          canEdit: true,
          canSave: true,
          canAdmin: true,
          canDelete: true,
        },
      };

      const result = getDsRefsFromV2Dashboard(dashboardV2);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ type: 'prometheus' });
    });

    it('should handle empty elements and variables', () => {
      const dashboardV2: DashboardWithAccessInfo<DashboardV2Spec> = {
        kind: 'DashboardWithAccessInfo',
        apiVersion: 'dashboard.grafana.app/v0alpha1',
        metadata: {
          name: 'test-dashboard',
          creationTimestamp: '',
          resourceVersion: '1',
        },
        spec: {
          ...defaultDashboardV2Spec(),
          elements: {},
          variables: [],
          title: 'Test Dashboard',
        },
        access: {
          canEdit: true,
          canSave: true,
          canAdmin: true,
          canDelete: true,
        },
      };

      const result = getDsRefsFromV2Dashboard(dashboardV2);

      expect(result).toEqual([]);
    });

    it('should deduplicate datasource refs by type', () => {
      const dashboardV2: DashboardWithAccessInfo<DashboardV2Spec> = {
        kind: 'DashboardWithAccessInfo',
        apiVersion: 'dashboard.grafana.app/v0alpha1',
        metadata: {
          name: 'test-dashboard',
          creationTimestamp: '',
          resourceVersion: '1',
        },
        spec: {
          ...defaultDashboardV2Spec(),
          elements: {
            panel1: {
              kind: 'Panel',
              spec: {
                id: 1,
                title: 'Test Panel',
                description: '',
                links: [],
                vizConfig: {
                  kind: 'VizConfig',
                  group: '',
                  version: '1.0.0',
                  spec: defaultVizConfigSpec(),
                },
                data: {
                  kind: 'QueryGroup',
                  spec: {
                    queries: [
                      {
                        kind: 'PanelQuery',
                        spec: {
                          refId: 'A',
                          hidden: false,
                          query: {
                            kind: 'DataQuery',
                            version: defaultDataQueryKind().version,
                            group: 'prometheus',
                            datasource: { name: 'ds-1' },
                            spec: {},
                          },
                        },
                      },
                      {
                        kind: 'PanelQuery',
                        spec: {
                          refId: 'B',
                          hidden: false,
                          query: {
                            kind: 'DataQuery',
                            version: defaultDataQueryKind().version,
                            group: 'prometheus',
                            datasource: { name: 'ds-2' },
                            spec: {},
                          },
                        },
                      },
                    ],
                    transformations: [],
                    queryOptions: {},
                  },
                },
              },
            },
          },
        },
        access: {
          canEdit: true,
          canSave: true,
          canAdmin: true,
          canDelete: true,
        },
      };

      const result = getDsRefsFromV2Dashboard(dashboardV2);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ uid: 'ds-1', type: 'prometheus' });
    });
  });
});
