import { DataQuery, DataSourceApi, DataSourceJsonData, LoadingState, QueryVariableModel } from '@grafana/data';
import { DataSourceSrv, getDataSourceSrv } from '@grafana/runtime';
import { DashboardLink, DataSourceRef, VariableHide } from '@grafana/schema';
import {
  Spec as DashboardV2Spec,
  defaultDataQueryKind,
  defaultVizConfigSpec,
  defaultSpec as defaultDashboardV2Spec,
} from '@grafana/schema/dist/esm/schema/dashboard/v2';
import { DashboardWithAccessInfo } from 'app/features/dashboard/api/types';
import { DashboardDTO } from 'app/types/dashboard';

import { getRuntimePanelDataSource } from '../serialization/layoutSerializers/utils';

import {
  deduplicateDatasourceRefsByType,
  getDsRefsFromV1Dashboard,
  getDsRefsFromV2Dashboard,
  loadDatasources,
  loadDefaultControlsFromDatasources,
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
const mockVariable1: QueryVariableModel = {
  name: 'var1',
  type: 'query',
  id: 'var1',
  rootStateKey: 'key',
  global: false,
  index: 0,
  state: LoadingState.Done,
  error: null,
  description: null,
  hide: 0,
  label: 'Variable 1',
  skipUrlSync: false,
  current: { selected: false, text: 'value1', value: 'value1' },
  options: [],
  query: '',
  datasource: { uid: 'ds-1', type: 'prometheus' },
  definition: '',
  sort: 0,
  regex: '',
  refresh: 1,
  multi: false,
  includeAll: false,
  allValue: null,
};

const mockVariable2: QueryVariableModel = {
  name: 'var2',
  type: 'query',
  id: 'var2',
  rootStateKey: 'key',
  global: false,
  index: 1,
  state: LoadingState.Done,
  error: null,
  description: null,
  hide: 0,
  label: 'Variable 2',
  skipUrlSync: false,
  current: { selected: false, text: 'value2', value: 'value2' },
  options: [],
  query: '',
  datasource: { uid: 'ds-2', type: 'loki' },
  definition: '',
  sort: 0,
  regex: '',
  refresh: 1,
  multi: false,
  includeAll: false,
  allValue: null,
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

  describe('deduplicateDatasourceRefsByType', () => {
    it('should return empty array for empty input', () => {
      const result = deduplicateDatasourceRefsByType([]);
      expect(result).toEqual([]);
    });

    it('should filter out null and undefined refs', () => {
      const refs: Array<DataSourceRef | null | undefined> = [
        { uid: 'ds-1', type: 'prometheus' },
        null,
        undefined,
        { uid: 'ds-2', type: 'loki' },
      ];

      const result = deduplicateDatasourceRefsByType(refs);
      expect(result).toHaveLength(2);
      expect(result).toEqual([
        { uid: 'ds-1', type: 'prometheus' },
        { uid: 'ds-2', type: 'loki' },
      ]);
    });

    it('should deduplicate refs by type, keeping the first occurrence', () => {
      const refs: Array<DataSourceRef | null | undefined> = [
        { uid: 'ds-1', type: 'prometheus' },
        { uid: 'ds-2', type: 'prometheus' },
        { uid: 'ds-3', type: 'loki' },
        { uid: 'ds-4', type: 'prometheus' },
      ];

      const result = deduplicateDatasourceRefsByType(refs);
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ uid: 'ds-1', type: 'prometheus' });
      expect(result[1]).toEqual({ uid: 'ds-3', type: 'loki' });
    });

    it('should handle refs without uid but with type', () => {
      const refs: Array<DataSourceRef | null | undefined> = [
        { type: 'prometheus' },
        { type: 'loki' },
        { type: 'prometheus' },
      ];

      const result = deduplicateDatasourceRefsByType(refs);
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ type: 'prometheus' });
      expect(result[1]).toEqual({ type: 'loki' });
    });

    it('should filter out refs without type', () => {
      const refs: Array<DataSourceRef | null | undefined> = [
        { uid: 'ds-1', type: 'prometheus' },
        { uid: 'ds-2' },
        { uid: 'ds-3', type: 'loki' },
      ];

      const result = deduplicateDatasourceRefsByType(refs);
      expect(result).toHaveLength(2);
      expect(result).toEqual([
        { uid: 'ds-1', type: 'prometheus' },
        { uid: 'ds-3', type: 'loki' },
      ]);
    });
  });

  describe('loadDatasources', () => {
    it('should load datasources for given refs', async () => {
      const refs: DataSourceRef[] = [
        { uid: 'ds-1', type: 'prometheus' },
        { uid: 'ds-2', type: 'loki' },
      ];

      const mockDs1 = createMockDatasource({ uid: 'ds-1', type: 'prometheus' });
      const mockDs2 = createMockDatasource({ uid: 'ds-2', type: 'loki' });

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

      const result = await loadDatasources(refs);

      expect(result).toHaveLength(2);
      expect(result[0]).toBe(mockDs1);
      expect(result[1]).toBe(mockDs2);
      expect(mockSrv.get).toHaveBeenCalledTimes(2);
      expect(mockSrv.get).toHaveBeenCalledWith({ uid: 'ds-1', type: 'prometheus' });
      expect(mockSrv.get).toHaveBeenCalledWith({ uid: 'ds-2', type: 'loki' });
    });

    it('should handle empty refs array', async () => {
      const mockSrv = createMockDataSourceSrv({
        get: jest.fn(),
      });

      getDataSourceSrvMock.mockReturnValue(mockSrv);

      const result = await loadDatasources([]);

      expect(result).toEqual([]);
      expect(mockSrv.get).not.toHaveBeenCalled();
    });
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
        getDefaultVariables: () => [mockVariable1],
        getDefaultLinks: undefined,
      });

      const mockDs2 = createMockDatasource({
        uid: 'ds-2',
        type: 'loki',
        getDefaultVariables: () => [mockVariable2],
        getDefaultLinks: undefined,
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
        hide: VariableHide.inControlsMenu,
        source: {
          uid: 'ds-1',
          sourceId: 'prometheus',
          sourceType: 'datasource',
        },
      });
      expect(result.defaultVariables[1]).toMatchObject({
        ...mockVariable2,
        hide: VariableHide.inControlsMenu,
        source: {
          uid: 'ds-2',
          sourceId: 'loki',
          sourceType: 'datasource',
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
        getDefaultLinks: () => [mockLink1, mockLink2],
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
        isDefault: true,
        parentDatasourceRef: { uid: 'ds-1', type: 'prometheus' },
        placement: 'inControlsMenu',
        source: {
          uid: 'ds-1',
          sourceId: 'prometheus',
          sourceType: 'datasource',
        },
      });
      expect(result.defaultLinks[1]).toMatchObject({
        ...mockLink2,
        isDefault: true,
        parentDatasourceRef: { uid: 'ds-1', type: 'prometheus' },
        placement: 'inControlsMenu',
        source: {
          uid: 'ds-1',
          sourceId: 'prometheus',
          sourceType: 'datasource',
        },
      });
    });

    it('should handle datasources with both variables and links', async () => {
      const refs: DataSourceRef[] = [{ uid: 'ds-1', type: 'prometheus' }];

      const mockDs = createMockDatasource({
        uid: 'ds-1',
        type: 'prometheus',
        getDefaultVariables: () => [mockVariable1],
        getDefaultLinks: () => [mockLink1],
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
