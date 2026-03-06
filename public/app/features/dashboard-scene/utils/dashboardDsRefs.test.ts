import { DataSourceRef } from '@grafana/schema';
import {
  Spec as DashboardV2Spec,
  defaultDataQueryKind,
  defaultVizConfigSpec,
  defaultSpec as defaultDashboardV2Spec,
} from '@grafana/schema/apis/dashboard.grafana.app/v2';
import { DashboardWithAccessInfo } from 'app/features/dashboard/api/types';
import { DashboardDataDTO, DashboardDTO } from 'app/types/dashboard';

import { getRuntimePanelDataSource } from '../serialization/layoutSerializers/utils';

import { getDsRefsFromV1Dashboard, getDsRefsFromV2Dashboard } from './dashboardDsRefs';

jest.mock('../serialization/layoutSerializers/utils', () => ({
  getRuntimePanelDataSource: jest.fn(),
}));

const getRuntimePanelDataSourceMock = getRuntimePanelDataSource as jest.MockedFunction<
  typeof getRuntimePanelDataSource
>;

const defaultV1Meta = {
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
};

function createMinimalV1DashboardDTO(overrides: Partial<DashboardDataDTO> = {}): DashboardDTO {
  const defaultDashboard = {
    id: 1,
    uid: 'test-dashboard-uid',
    title: 'Test Dashboard',
    tags: [] as string[],
    timezone: 'browser',
    panels: [] as DashboardDTO['dashboard']['panels'],
    time: { from: 'now-6h', to: 'now' },
    timepicker: {},
    templating: { list: [] },
    annotations: { list: [] },
    refresh: '',
    schemaVersion: 30,
    version: 1,
    links: [] as DashboardDTO['dashboard']['links'],
  };
  return {
    dashboard: { ...defaultDashboard, ...overrides },
    meta: { ...defaultV1Meta },
  };
}

function createMinimalV2Dashboard(overrides: Partial<DashboardV2Spec> = {}): DashboardWithAccessInfo<DashboardV2Spec> {
  const defaultSpec = {
    ...defaultDashboardV2Spec(),
    elements: {} as NonNullable<DashboardV2Spec['elements']>,
    variables: [] as NonNullable<DashboardV2Spec['variables']>,
    title: 'Test Dashboard',
  };

  return {
    kind: 'DashboardWithAccessInfo',
    apiVersion: 'dashboard.grafana.app/v0alpha1',
    metadata: {
      name: 'test-dashboard',
      creationTimestamp: '',
      resourceVersion: '1',
    },
    spec: { ...defaultSpec, ...overrides },
    access: {
      canEdit: true,
      canSave: true,
      canAdmin: true,
      canDelete: true,
    },
  };
}

describe('dashboardDsRefs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getDsRefsFromV1Dashboard', () => {
    it('should extract datasource refs from panels', () => {
      const dashboardDTO = createMinimalV1DashboardDTO({
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
      });

      const result = getDsRefsFromV1Dashboard(dashboardDTO);

      expect(result).toHaveLength(2);
      expect(result).toEqual([
        { uid: 'ds-1', type: 'prometheus' },
        { uid: 'ds-2', type: 'loki' },
      ]);
    });

    it('should extract datasource refs from panel targets when panel datasource is missing', () => {
      const dashboardDTO = createMinimalV1DashboardDTO({
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
      });

      const result = getDsRefsFromV1Dashboard(dashboardDTO);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ uid: 'ds-1', type: 'prometheus' });
    });

    it('should extract datasource refs from query variables', () => {
      const dashboardDTO = createMinimalV1DashboardDTO({
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
      });

      const result = getDsRefsFromV1Dashboard(dashboardDTO);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ uid: 'ds-1', type: 'prometheus' });
    });

    it('should extract datasource refs from datasource variables', () => {
      const dashboardDTO = createMinimalV1DashboardDTO({
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
      });

      const result = getDsRefsFromV1Dashboard(dashboardDTO);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ type: 'prometheus' });
    });

    it('should deduplicate datasource refs by type', () => {
      const dashboardDTO = createMinimalV1DashboardDTO({
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
      });

      const result = getDsRefsFromV1Dashboard(dashboardDTO);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ uid: 'ds-1', type: 'prometheus' });
    });
  });

  describe('getDsRefsFromV2Dashboard', () => {
    it('should extract datasource refs from panel queries', () => {
      const dashboardV2 = createMinimalV2Dashboard({
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
      });

      const result = getDsRefsFromV2Dashboard(dashboardV2);

      expect(result).toHaveLength(2);
      expect(result).toEqual([
        { uid: 'ds-1', type: 'prometheus' },
        { uid: 'ds-2', type: 'loki' },
      ]);
    });

    it('should use getRuntimePanelDataSource when datasource name is missing', () => {
      const dashboardV2 = createMinimalV2Dashboard({
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
      });

      getRuntimePanelDataSourceMock.mockReturnValue({
        uid: 'runtime-ds',
        type: 'prometheus',
      } as DataSourceRef);

      const result = getDsRefsFromV2Dashboard(dashboardV2);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ uid: 'runtime-ds', type: 'prometheus' });
      expect(getRuntimePanelDataSourceMock).toHaveBeenCalled();
    });

    it('should extract datasource refs from QueryVariable', () => {
      const dashboardV2 = createMinimalV2Dashboard({
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
      });

      const result = getDsRefsFromV2Dashboard(dashboardV2);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ uid: 'ds-1', type: 'prometheus' });
    });

    it('should extract datasource refs from QueryVariable with only group', () => {
      const dashboardV2 = createMinimalV2Dashboard({
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
      });

      const result = getDsRefsFromV2Dashboard(dashboardV2);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ type: 'prometheus' });
    });

    it('should extract datasource refs from DatasourceVariable', () => {
      const dashboardV2 = createMinimalV2Dashboard({
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
      });

      const result = getDsRefsFromV2Dashboard(dashboardV2);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ type: 'prometheus' });
    });

    it('should handle empty elements and variables', () => {
      const dashboardV2 = createMinimalV2Dashboard();

      const result = getDsRefsFromV2Dashboard(dashboardV2);

      expect(result).toEqual([]);
    });

    it('should deduplicate datasource refs by type', () => {
      const dashboardV2 = createMinimalV2Dashboard({
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
      });

      const result = getDsRefsFromV2Dashboard(dashboardV2);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ uid: 'ds-1', type: 'prometheus' });
    });
  });
});
