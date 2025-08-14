import { AnnotationQuery, DataQuery, VariableModel, VariableRefresh, Panel } from '@grafana/schema';
import {
  Spec as DashboardV2Spec,
  defaultDataQueryKind,
  GridLayoutItemKind,
  GridLayoutKind,
  PanelKind,
  RowsLayoutKind,
  RowsLayoutRowKind,
  VariableKind,
} from '@grafana/schema/dist/esm/schema/dashboard/v2';
import { handyTestingSchema } from '@grafana/schema/dist/esm/schema/dashboard/v2_examples';
import {
  AnnoKeyCreatedBy,
  AnnoKeyDashboardGnetId,
  AnnoKeyFolder,
  AnnoKeySlug,
  AnnoKeyUpdatedBy,
  AnnoKeyUpdatedTimestamp,
  DeprecatedInternalId,
} from 'app/features/apiserver/types';
import { getDefaultDataSourceRef } from 'app/features/dashboard-scene/serialization/transformSceneToSaveModelSchemaV2';
import {
  LEGACY_STRING_VALUE_KEY,
  transformVariableHideToEnum,
  transformVariableRefreshToEnum,
} from 'app/features/dashboard-scene/serialization/transformToV2TypesUtils';
import { DashboardDataDTO, DashboardDTO } from 'app/types/dashboard';

import {
  getDefaultDatasource,
  getPanelQueries,
  ResponseTransformers,
  transformMappingsToV1,
} from './ResponseTransformers';
import { DashboardWithAccessInfo } from './types';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  config: {
    ...jest.requireActual('@grafana/runtime').config,
    bootData: {
      ...jest.requireActual('@grafana/runtime').config.bootData,
      settings: {
        ...jest.requireActual('@grafana/runtime').config.bootData.settings,
        datasources: {
          PromTest: {
            uid: 'xyz-abc',
            name: 'PromTest',
            id: 'prometheus',
            meta: {
              id: 'prometheus',
              name: 'PromTest',
              type: 'datasource',
            },
            isDefault: true,
            apiVersion: 'v2',
          },
          '-- Grafana --': {
            uid: 'grafana',
            name: '-- Grafana --',
            id: 'grafana',
            meta: {
              id: 'grafana',
              name: '-- Grafana --',
              type: 'datasource',
            },
            isDefault: false,
          },
        },

        defaultDatasource: 'PromTest',
      },
    },
  },
}));

describe('ResponseTransformers', () => {
  describe('getDefaultDataSource', () => {
    it('should return prometheus as default', () => {
      expect(getDefaultDatasource()).toEqual({
        apiVersion: 'v2',
        uid: 'PromTest',
        type: 'prometheus',
      });
    });
  });

  describe('getDefaultDataSourceRef', () => {
    it('should return prometheus as default', () => {
      expect(getDefaultDataSourceRef()).toEqual({
        uid: 'PromTest',
        type: 'prometheus',
      });
    });
  });

  describe('v1 -> v2 transformation', () => {
    it('should transform DashboardDTO to DashboardWithAccessInfo<DashboardV2Spec>', () => {
      const dashboardV1: DashboardDataDTO = {
        uid: 'dashboard-uid',
        id: 123,
        title: 'Dashboard Title',
        description: 'Dashboard Description',
        tags: ['tag1', 'tag2'],
        schemaVersion: 1,
        graphTooltip: 0,
        preload: true,
        liveNow: false,
        editable: true,
        time: { from: 'now-6h', to: 'now' },
        timezone: 'browser',
        refresh: '5m',
        timepicker: {
          refresh_intervals: ['5s', '10s', '30s'],
          hidden: false,
          nowDelay: '1m',
          quick_ranges: [
            {
              display: 'Last 6 hours',
              from: 'now-6h',
              to: 'now',
            },
            {
              display: 'Last 7 days',
              from: 'now-7d',
              to: 'now',
            },
          ],
        },
        fiscalYearStartMonth: 1,
        weekStart: 'monday',
        version: 1,
        gnetId: 'something-like-a-uid',
        revision: 225,
        links: [
          {
            title: 'Link 1',
            url: 'https://grafana.com',
            asDropdown: false,
            targetBlank: true,
            includeVars: true,
            keepTime: true,
            tags: ['tag1', 'tag2'],
            icon: 'external link',
            type: 'link',
            tooltip: 'Link 1 Tooltip',
          },
        ],
        annotations: {
          list: [],
        },
        templating: {
          list: [
            {
              type: 'query',
              name: 'var1',
              label: 'query var',
              description: 'query var description',
              skipUrlSync: false,
              hide: 0,
              multi: true,
              includeAll: true,
              current: { value: '1', text: '1' },
              options: [
                { selected: true, text: '1', value: '1' },
                { selected: false, text: '2', value: '2' },
              ],
              refresh: VariableRefresh.onTimeRangeChanged,
              datasource: {
                type: 'prometheus',
                uid: 'abc',
              },
              regex: '.*',
              sort: 1,
              query: {
                expr: 'sum(query)',
              },
            },
            {
              type: 'datasource',
              name: 'var2',
              label: 'datasource var',
              description: 'datasource var description',
              skipUrlSync: false,
              hide: 0,
              multi: true,
              includeAll: true,
              current: { value: 'PromTest', text: 'PromTest' },
              options: [
                { selected: true, text: 'PromTest', value: 'PromTest' },
                { selected: false, text: 'Grafana', value: 'Grafana' },
              ],
              refresh: VariableRefresh.onTimeRangeChanged,
              regex: '.*',
              sort: 1,
              query: 'sum(query)',
            },
            {
              type: 'custom',
              name: 'var3',
              label: 'custom var',
              description: 'custom var description',
              skipUrlSync: false,
              hide: 0,
              multi: true,
              includeAll: true,
              current: { value: '1', text: '1' },
              query: '1,2,3',
              options: [
                { selected: true, text: '1', value: '1' },
                { selected: false, text: '2', value: '2' },
              ],
              allValue: '1,2,3',
            },
            {
              type: 'adhoc',
              name: 'var4',
              label: 'adhoc var',
              description: 'adhoc var description',
              skipUrlSync: false,
              hide: 0,
              datasource: {
                type: 'prometheus',
                uid: 'abc',
              },
              // @ts-expect-error
              baseFilters: [{ key: 'key1', operator: 'AND' }],
              filters: [],
              defaultKeys: [],
            },
            {
              type: 'constant',
              name: 'var5',
              label: 'constant var',
              description: 'constant var description',
              skipUrlSync: false,
              hide: 0,
              current: { value: '1', text: '0' },
              query: '1',
            },
            {
              type: 'interval',
              name: 'var6',
              label: 'interval var',
              description: 'interval var description',
              skipUrlSync: false,
              query: '1m,10m,30m,1h',
              hide: 0,
              current: {
                value: 'auto',
                text: 'auto',
              },
              refresh: VariableRefresh.onTimeRangeChanged,
              options: [
                {
                  selected: true,
                  text: '1m',
                  value: '1m',
                },
                {
                  selected: false,
                  text: '10m',
                  value: '10m',
                },
                {
                  selected: false,
                  text: '30m',
                  value: '30m',
                },
                {
                  selected: false,
                  text: '1h',
                  value: '1h',
                },
              ],
              // @ts-expect-error
              auto: false,
              auto_min: '1s',
              auto_count: 1,
            },
            {
              type: 'textbox',
              name: 'var7',
              label: 'textbox var',
              description: 'textbox var description',
              skipUrlSync: false,
              hide: 0,
              current: { value: '1', text: '1' },
              query: '1',
            },
            {
              type: 'groupby',
              name: 'var8',
              label: 'groupby var',
              description: 'groupby var description',
              skipUrlSync: false,
              hide: 0,
              datasource: {
                type: 'prometheus',
                uid: 'abc',
              },
              options: [
                { selected: true, text: '1', value: '1' },
                { selected: false, text: '2', value: '2' },
              ],
              current: { value: ['1'], text: ['1'] },
            },
            // Query variable with minimal props and without current
            {
              datasource: { type: 'prometheus', uid: 'abc' },
              name: 'org_id',
              label: 'Org ID',
              hide: 2,
              type: 'query',
              query: { refId: 'A', query: 'label_values(grafanacloud_org_info{org_slug="$org_slug"}, org_id)' },
            },
          ],
        },
        panels: [
          {
            id: 1,
            type: 'timeseries',
            title: 'Panel Title',
            gridPos: { x: 0, y: 0, w: 12, h: 8 },
            targets: [
              {
                refId: 'A',
                datasource: 'datasource1',
                expr: 'test-query',
                hide: false,
              },
            ],
            datasource: {
              type: 'prometheus',
              uid: 'datasource1',
            },
            fieldConfig: { defaults: {}, overrides: [] },
            options: {},
            transparent: false,
            links: [],
            transformations: [],
            repeat: 'var1',
            repeatDirection: 'h',
          },
          {
            id: 2,
            type: 'table',
            title: 'Just a shared table',
            libraryPanel: {
              uid: 'library-panel-table',
              name: 'Table Panel as Library Panel',
            },
            gridPos: { x: 0, y: 8, w: 12, h: 8 },
          },
        ],
      };

      const dto: DashboardWithAccessInfo<DashboardDataDTO> = {
        spec: dashboardV1,
        access: {
          slug: 'dashboard-slug',
          url: '/d/dashboard-slug',
          canAdmin: true,
          canDelete: true,
          canEdit: true,
          canSave: true,
          canShare: true,
          canStar: true,
          annotationsPermissions: {
            dashboard: { canAdd: true, canEdit: true, canDelete: true },
            organization: { canAdd: true, canEdit: true, canDelete: true },
          },
        },
        apiVersion: 'v1',
        kind: 'DashboardWithAccessInfo',
        metadata: {
          name: 'dashboard-uid',
          resourceVersion: '1',
          creationTimestamp: '2023-01-01T00:00:00Z',
          annotations: {
            [AnnoKeyCreatedBy]: 'user1',
            [AnnoKeyUpdatedBy]: 'user2',
            [AnnoKeyUpdatedTimestamp]: '2023-01-02T00:00:00Z',
            [AnnoKeyFolder]: 'folder1',
            [AnnoKeySlug]: 'dashboard-slug',
          },
          labels: {
            [DeprecatedInternalId]: '123',
          },
        },
      };

      const transformed = ResponseTransformers.ensureV2Response(dto);

      // Metadata
      expect(transformed.apiVersion).toBe('v2beta1');
      expect(transformed.kind).toBe('DashboardWithAccessInfo');
      expect(transformed.metadata.annotations?.[AnnoKeyCreatedBy]).toEqual('user1');
      expect(transformed.metadata.annotations?.[AnnoKeyUpdatedBy]).toEqual('user2');
      expect(transformed.metadata.annotations?.[AnnoKeyUpdatedTimestamp]).toEqual('2023-01-02T00:00:00Z');
      expect(transformed.metadata.annotations?.[AnnoKeyFolder]).toEqual('folder1');
      expect(transformed.metadata.annotations?.[AnnoKeySlug]).toEqual('dashboard-slug');
      expect(transformed.metadata.annotations?.[AnnoKeyDashboardGnetId]).toBe('something-like-a-uid');
      expect(transformed.metadata.labels?.[DeprecatedInternalId]).toBe('123');

      // Spec
      const spec = transformed.spec;
      expect(spec.title).toBe(dashboardV1.title);
      expect(spec.description).toBe(dashboardV1.description);
      expect(spec.tags).toEqual(dashboardV1.tags);
      expect(spec.cursorSync).toBe('Off'); // Assuming transformCursorSynctoEnum(0) returns 'Off'
      expect(spec.preload).toBe(dashboardV1.preload);
      expect(spec.liveNow).toBe(dashboardV1.liveNow);
      expect(spec.editable).toBe(dashboardV1.editable);
      expect(spec.revision).toBe(dashboardV1.revision);
      expect(spec.timeSettings.from).toBe(dashboardV1.time?.from);
      expect(spec.timeSettings.to).toBe(dashboardV1.time?.to);
      expect(spec.timeSettings.timezone).toBe(dashboardV1.timezone);
      expect(spec.timeSettings.autoRefresh).toBe(dashboardV1.refresh);
      expect(spec.timeSettings.autoRefreshIntervals).toEqual(dashboardV1.timepicker?.refresh_intervals);
      expect(spec.timeSettings.hideTimepicker).toBe(dashboardV1.timepicker?.hidden);
      expect(spec.timeSettings.quickRanges).toEqual(dashboardV1.timepicker?.quick_ranges);
      expect(spec.timeSettings.nowDelay).toBe(dashboardV1.timepicker?.nowDelay);
      expect(spec.timeSettings.fiscalYearStartMonth).toBe(dashboardV1.fiscalYearStartMonth);
      expect(spec.timeSettings.weekStart).toBe(dashboardV1.weekStart);
      expect(spec.links).toEqual(dashboardV1.links);
      expect(spec.annotations).toEqual([]);

      // Panel
      expect(spec.layout.kind).toBe('GridLayout');
      const layout = spec.layout as GridLayoutKind;
      expect(layout.spec.items).toHaveLength(2);
      expect(layout.spec.items[0].spec).toEqual({
        element: {
          kind: 'ElementReference',
          name: 'panel-1',
        },
        x: 0,
        y: 0,
        width: 12,
        height: 8,
        repeat: { value: 'var1', direction: 'h', mode: 'variable', maxPerRow: undefined },
      });
      expect(spec.elements['panel-1']).toEqual({
        kind: 'Panel',
        spec: {
          title: 'Panel Title',
          description: '',
          id: 1,
          links: [],
          vizConfig: {
            kind: 'VizConfig',
            group: 'timeseries',
            version: '',
            spec: {
              fieldConfig: {
                defaults: {},
                overrides: [],
              },
              options: {},
            },
          },
          data: {
            kind: 'QueryGroup',
            spec: {
              queries: [
                {
                  kind: 'PanelQuery',
                  spec: {
                    hidden: false,
                    query: {
                      kind: 'DataQuery',
                      version: defaultDataQueryKind().version,
                      group: 'prometheus',
                      datasource: {
                        name: 'datasource1',
                      },
                      spec: {
                        expr: 'test-query',
                      },
                    },
                    refId: 'A',
                  },
                },
              ],
              queryOptions: {},
              transformations: [],
            },
          },
        },
      });
      // Library Panel
      expect(layout.spec.items[1].spec).toEqual({
        element: {
          kind: 'ElementReference',
          name: 'panel-2',
        },
        x: 0,
        y: 8,
        width: 12,
        height: 8,
      });
      expect(spec.elements['panel-2']).toEqual({
        kind: 'LibraryPanel',
        spec: {
          libraryPanel: {
            uid: 'library-panel-table',
            name: 'Table Panel as Library Panel',
          },
          id: 2,
          title: 'Just a shared table',
        },
      });

      // Variables
      validateVariablesV1ToV2(spec.variables[0], dashboardV1.templating?.list?.[0]);
      validateVariablesV1ToV2(spec.variables[1], dashboardV1.templating?.list?.[1]);
      validateVariablesV1ToV2(spec.variables[2], dashboardV1.templating?.list?.[2]);
      validateVariablesV1ToV2(spec.variables[3], dashboardV1.templating?.list?.[3]);
      validateVariablesV1ToV2(spec.variables[4], dashboardV1.templating?.list?.[4]);
      validateVariablesV1ToV2(spec.variables[5], dashboardV1.templating?.list?.[5]);
      validateVariablesV1ToV2(spec.variables[6], dashboardV1.templating?.list?.[6]);
      validateVariablesV1ToV2(spec.variables[7], dashboardV1.templating?.list?.[7]);
      validateVariablesV1ToV2(spec.variables[8], dashboardV1.templating?.list?.[8]);
    });
  });

  describe('v1 -> v2 transformation with rows', () => {
    it('should transform DashboardDTO to DashboardWithAccessInfo<DashboardV2Spec>', () => {
      const dashboardV1: DashboardDataDTO = {
        uid: 'dashboard-uid',
        id: 123,
        title: 'Dashboard Title',
        description: 'Dashboard Description',
        tags: ['tag1', 'tag2'],
        schemaVersion: 1,
        graphTooltip: 0,
        preload: true,
        liveNow: false,
        editable: true,
        time: { from: 'now-6h', to: 'now' },
        timezone: 'browser',
        refresh: '5m',
        timepicker: {
          refresh_intervals: ['5s', '10s', '30s'],
          hidden: false,
          nowDelay: '1m',
          quick_ranges: [
            {
              display: 'Last 6 hours',
              from: 'now-6h',
              to: 'now',
            },
            {
              display: 'Last 7 days',
              from: 'now-7d',
              to: 'now',
            },
          ],
        },
        fiscalYearStartMonth: 1,
        weekStart: 'monday',
        version: 1,
        gnetId: 'something-like-a-uid',
        revision: 225,
        links: [],
        annotations: {
          list: [],
        },
        templating: {
          list: [],
        },
        panels: [
          {
            id: 1,
            type: 'timeseries',
            title: 'Panel Title',
            gridPos: { x: 0, y: 0, w: 12, h: 8 },
            targets: [
              {
                refId: 'A',
                datasource: 'datasource1',
                expr: 'test-query',
                hide: false,
              },
            ],
            datasource: {
              type: 'prometheus',
              uid: 'datasource1',
            },
            fieldConfig: { defaults: {}, overrides: [] },
            options: {},
            transparent: false,
            links: [],
            transformations: [],
            repeat: 'var1',
            repeatDirection: 'h',
          },
          {
            id: 2,
            type: 'table',
            title: 'Just a shared table',
            libraryPanel: {
              uid: 'library-panel-table',
              name: 'Table Panel as Library Panel',
            },
            gridPos: { x: 0, y: 8, w: 12, h: 8 },
          },
          {
            id: 3,
            type: 'row',
            title: 'Row test title',
            gridPos: { x: 0, y: 16, w: 12, h: 1 },
            repeat: 'var1',
            repeatDirection: 'v',
            panels: [],
            collapsed: false,
          },
          {
            id: 4,
            type: 'timeseries',
            title: 'Panel in row',
            gridPos: { x: 0, y: 17, w: 16, h: 8 },
            targets: [
              {
                refId: 'A',
                datasource: 'datasource1',
                expr: 'test-query',
                hide: false,
              },
            ],
            datasource: {
              type: 'prometheus',
              uid: 'datasource1',
            },
            fieldConfig: { defaults: {}, overrides: [] },
            options: {},
            transparent: false,
            links: [],
            transformations: [],
          },
          {
            id: 5,
            type: 'row',
            title: 'Collapsed row title',
            gridPos: { x: 0, y: 25, w: 12, h: 1 },
            panels: [
              {
                id: 6,
                type: 'timeseries',
                title: 'Panel in collapsed row',
                gridPos: { x: 0, y: 26, w: 16, h: 8 },
                targets: [
                  {
                    refId: 'A',
                    datasource: 'datasource1',
                    expr: 'test-query',
                    hide: false,
                  },
                ],
                datasource: {
                  type: 'prometheus',
                  uid: 'datasource1',
                },
                fieldConfig: { defaults: {}, overrides: [] },
                options: {},
                transparent: false,
                links: [],
                transformations: [],
              },
            ],
            collapsed: true,
          },
          {
            id: 7,
            type: 'row',
            title: 'collapsed row with no panel property',
            gridPos: { x: 0, y: 26, w: 12, h: 1 },
            collapsed: true,
          },
          {
            id: 8,
            type: 'row',
            title: 'empty row',
            gridPos: { x: 0, y: 27, w: 12, h: 1 },
            collapsed: false,
          },
        ],
      };

      const dto: DashboardWithAccessInfo<DashboardDataDTO> = {
        spec: dashboardV1,
        access: {
          slug: 'dashboard-slug',
          url: '/d/dashboard-slug',
          canAdmin: true,
          canDelete: true,
          canEdit: true,
          canSave: true,
          canShare: true,
          canStar: true,
          annotationsPermissions: {
            dashboard: { canAdd: true, canEdit: true, canDelete: true },
            organization: { canAdd: true, canEdit: true, canDelete: true },
          },
        },
        apiVersion: 'v1',
        kind: 'DashboardWithAccessInfo',
        metadata: {
          name: 'dashboard-uid',
          resourceVersion: '1',
          creationTimestamp: '2023-01-01T00:00:00Z',
          annotations: {
            [AnnoKeyCreatedBy]: 'user1',
            [AnnoKeyUpdatedBy]: 'user2',
            [AnnoKeyUpdatedTimestamp]: '2023-01-02T00:00:00Z',
            [AnnoKeyFolder]: 'folder1',
            [AnnoKeySlug]: 'dashboard-slug',
          },
          labels: {
            [DeprecatedInternalId]: '123',
          },
        },
      };

      const transformed = ResponseTransformers.ensureV2Response(dto);

      const spec = transformed.spec;

      // Panel
      expect(spec.layout.kind).toBe('RowsLayout');
      const layout = spec.layout as RowsLayoutKind;
      expect(layout.spec.rows).toHaveLength(5);

      const row0grid = layout.spec.rows[0].spec.layout as GridLayoutKind;
      expect(row0grid.kind).toBe('GridLayout');
      expect(row0grid.spec.items).toHaveLength(2);
      expect(row0grid.spec.items[0].spec.element.name).toBe('panel-1');
      expect(row0grid.spec.items[0].spec.y).toBe(0);
      expect(row0grid.spec.items[1].spec.element.name).toBe('panel-2');
      expect(row0grid.spec.items[1].spec.y).toBe(8);

      const row1 = layout.spec.rows[1] as RowsLayoutRowKind;
      expect(row1.kind).toBe('RowsLayoutRow');
      expect(row1.spec.repeat?.value).toBe('var1');
      expect(row1.spec.repeat?.mode).toBe('variable');

      const row1grid = layout.spec.rows[1].spec.layout as GridLayoutKind;
      expect(row1grid.kind).toBe('GridLayout');
      expect(row1grid.spec.items).toHaveLength(1);
      expect(row1grid.spec.items[0].spec.element.name).toBe('panel-4');

      const row2grid = layout.spec.rows[2].spec.layout as GridLayoutKind;
      expect(row2grid.kind).toBe('GridLayout');
      expect(row2grid.spec.items).toHaveLength(1);
      expect(row2grid.spec.items[0].spec.element.name).toBe('panel-6');

      const row3 = layout.spec.rows[3] as RowsLayoutRowKind;
      expect(row3.kind).toBe('RowsLayoutRow');
      expect(row3.spec.collapse).toBe(true);
      expect(row3.spec.layout.kind).toBe('GridLayout');
      const row3grid = row3.spec.layout as GridLayoutKind;
      expect(row3grid.kind).toBe('GridLayout');
      expect(row3grid.spec.items).toHaveLength(0);

      const row4 = layout.spec.rows[4] as RowsLayoutRowKind;
      expect(row4.kind).toBe('RowsLayoutRow');
      expect(row4.spec.collapse).toBe(false);
      expect(row4.spec.layout.kind).toBe('GridLayout');
      const row4grid = row4.spec.layout as GridLayoutKind;
      expect(row4grid.kind).toBe('GridLayout');
      expect(row4grid.spec.items).toHaveLength(0);
    });
  });

  describe('v2 -> v1 transformation', () => {
    it('should return the same object if it is already a DashboardDTO', () => {
      const dashboard: DashboardDTO = {
        dashboard: {
          schemaVersion: 1,
          title: 'Dashboard Title',
          uid: 'dashboard1',
          version: 1,
        },
        meta: {},
      };

      expect(ResponseTransformers.ensureV1Response(dashboard)).toBe(dashboard);
    });

    it('should transform DashboardWithAccessInfo<DashboardV2Spec> to DashboardDTO', () => {
      const dashboardV2: DashboardWithAccessInfo<DashboardV2Spec> = {
        apiVersion: 'v2beta1',
        kind: 'DashboardWithAccessInfo',
        metadata: {
          creationTimestamp: '2023-01-01T00:00:00Z',
          name: 'dashboard1',
          resourceVersion: '1',
          annotations: {
            'grafana.app/createdBy': 'user1',
            'grafana.app/updatedBy': 'user2',
            'grafana.app/updatedTimestamp': '2023-01-02T00:00:00Z',
            'grafana.app/folder': 'folder1',
            'grafana.app/slug': 'dashboard-slug',
            'grafana.app/dashboard-gnet-id': 'something-like-a-uid',
          },
        },
        spec: {
          title: 'Dashboard Title',
          description: 'Dashboard Description',
          tags: ['tag1', 'tag2'],
          cursorSync: 'Off',
          preload: true,
          liveNow: false,
          editable: true,
          revision: 225,
          timeSettings: {
            from: 'now-6h',
            to: 'now',
            timezone: 'browser',
            autoRefresh: '5m',
            autoRefreshIntervals: ['5s', '10s', '30s'],
            hideTimepicker: false,
            quickRanges: [
              {
                display: 'Last 6 hours',
                from: 'now-6h',
                to: 'now',
              },
              {
                display: 'Last 7 days',
                from: 'now-7d',
                to: 'now',
              },
            ],
            nowDelay: '1m',
            fiscalYearStartMonth: 1,
            weekStart: 'monday',
          },
          links: [
            {
              title: 'Link 1',
              url: 'https://grafana.com',
              asDropdown: false,
              targetBlank: true,
              includeVars: true,
              keepTime: true,
              tags: ['tag1', 'tag2'],
              icon: 'external link',
              type: 'link',
              tooltip: 'Link 1 Tooltip',
            },
          ],
          annotations: handyTestingSchema.annotations,
          variables: handyTestingSchema.variables,
          elements: handyTestingSchema.elements,
          layout: handyTestingSchema.layout,
        },
        access: {
          url: '/d/dashboard-slug',
          canAdmin: true,
          canDelete: true,
          canEdit: true,
          canSave: true,
          canShare: true,
          canStar: true,
          slug: 'dashboard-slug',
          annotationsPermissions: {
            dashboard: { canAdd: true, canEdit: true, canDelete: true },
            organization: { canAdd: true, canEdit: true, canDelete: true },
          },
        },
      };

      const transformed = ResponseTransformers.ensureV1Response(dashboardV2);

      expect(transformed.meta.created).toBe(dashboardV2.metadata.creationTimestamp);
      expect(transformed.meta.createdBy).toBe(dashboardV2.metadata.annotations?.['grafana.app/createdBy']);
      expect(transformed.meta.updated).toBe(dashboardV2.metadata.annotations?.['grafana.app/updatedTimestamp']);
      expect(transformed.meta.updatedBy).toBe(dashboardV2.metadata.annotations?.['grafana.app/updatedBy']);
      expect(transformed.meta.folderUid).toBe(dashboardV2.metadata.annotations?.['grafana.app/folder']);
      expect(transformed.meta.slug).toBe(dashboardV2.metadata.annotations?.['grafana.app/slug']);
      expect(transformed.meta.url).toBe(dashboardV2.access.url);
      expect(transformed.meta.canAdmin).toBe(dashboardV2.access.canAdmin);
      expect(transformed.meta.canDelete).toBe(dashboardV2.access.canDelete);
      expect(transformed.meta.canEdit).toBe(dashboardV2.access.canEdit);
      expect(transformed.meta.canSave).toBe(dashboardV2.access.canSave);
      expect(transformed.meta.canShare).toBe(dashboardV2.access.canShare);
      expect(transformed.meta.canStar).toBe(dashboardV2.access.canStar);
      expect(transformed.meta.annotationsPermissions).toEqual(dashboardV2.access.annotationsPermissions);

      const dashboard = transformed.dashboard;
      expect(dashboard.uid).toBe(dashboardV2.metadata.name);
      expect(dashboard.title).toBe(dashboardV2.spec.title);
      expect(dashboard.description).toBe(dashboardV2.spec.description);
      expect(dashboard.tags).toEqual(dashboardV2.spec.tags);
      expect(dashboard.schemaVersion).toBe(40);
      //   expect(dashboard.graphTooltip).toBe(0); // Assuming transformCursorSynctoEnum('Off') returns 0
      expect(dashboard.preload).toBe(dashboardV2.spec.preload);
      expect(dashboard.liveNow).toBe(dashboardV2.spec.liveNow);
      expect(dashboard.editable).toBe(dashboardV2.spec.editable);
      expect(dashboard.revision).toBe(225);
      expect(dashboard.gnetId).toBe(dashboardV2.metadata.annotations?.['grafana.app/dashboard-gnet-id']);
      expect(dashboard.time?.from).toBe(dashboardV2.spec.timeSettings.from);
      expect(dashboard.time?.to).toBe(dashboardV2.spec.timeSettings.to);
      expect(dashboard.timezone).toBe(dashboardV2.spec.timeSettings.timezone);
      expect(dashboard.refresh).toBe(dashboardV2.spec.timeSettings.autoRefresh);
      expect(dashboard.timepicker?.refresh_intervals).toEqual(dashboardV2.spec.timeSettings.autoRefreshIntervals);
      expect(dashboard.timepicker?.hidden).toBe(dashboardV2.spec.timeSettings.hideTimepicker);
      expect(dashboard.timepicker?.nowDelay).toBe(dashboardV2.spec.timeSettings.nowDelay);
      expect(dashboard.fiscalYearStartMonth).toBe(dashboardV2.spec.timeSettings.fiscalYearStartMonth);
      expect(dashboard.weekStart).toBe(dashboardV2.spec.timeSettings.weekStart);
      expect(dashboard.links).toEqual(dashboardV2.spec.links);
      // variables
      validateVariablesV1ToV2(dashboardV2.spec.variables[0], dashboard.templating?.list?.[0]);
      validateVariablesV1ToV2(dashboardV2.spec.variables[1], dashboard.templating?.list?.[1]);
      validateVariablesV1ToV2(dashboardV2.spec.variables[2], dashboard.templating?.list?.[2]);
      validateVariablesV1ToV2(dashboardV2.spec.variables[3], dashboard.templating?.list?.[3]);
      validateVariablesV1ToV2(dashboardV2.spec.variables[4], dashboard.templating?.list?.[4]);
      validateVariablesV1ToV2(dashboardV2.spec.variables[5], dashboard.templating?.list?.[5]);
      validateVariablesV1ToV2(dashboardV2.spec.variables[6], dashboard.templating?.list?.[6]);
      validateVariablesV1ToV2(dashboardV2.spec.variables[7], dashboard.templating?.list?.[7]);
      // annotations
      validateAnnotation(dashboard.annotations!.list![0], dashboardV2.spec.annotations[0]);
      validateAnnotation(dashboard.annotations!.list![1], dashboardV2.spec.annotations[1]);
      validateAnnotation(dashboard.annotations!.list![2], dashboardV2.spec.annotations[2]);
      validateAnnotation(dashboard.annotations!.list![3], dashboardV2.spec.annotations[3]);
      // panel
      const panelKey = 'panel-1';
      expect(dashboardV2.spec.elements[panelKey].kind).toBe('Panel');
      const panelV2 = dashboardV2.spec.elements[panelKey] as PanelKind;
      expect(panelV2.kind).toBe('Panel');
      expect(dashboardV2.spec.layout.kind).toBe('GridLayout');
      validatePanel(dashboard.panels![0], panelV2, dashboardV2.spec.layout as GridLayoutKind, panelKey);
      // library panel
      expect(dashboard.panels![1].libraryPanel).toEqual({
        uid: 'uid-for-library-panel',
        name: 'Library Panel',
      });
    });

    describe('getPanelQueries', () => {
      it('respects targets data source', () => {
        const panelDs = {
          type: 'theoretical-ds',
          uid: 'theoretical-uid',
        };
        const targets: DataQuery[] = [
          {
            refId: 'A',
            datasource: {
              type: 'theoretical-ds',
              uid: 'theoretical-uid',
            },
          },
          {
            refId: 'B',
            datasource: {
              type: 'theoretical-ds',
              uid: 'theoretical-uid',
            },
          },
        ];

        const result = getPanelQueries(targets, panelDs);

        expect(result).toHaveLength(targets.length);
        expect(result[0].spec.refId).toBe('A');
        expect(result[1].spec.refId).toBe('B');

        result.forEach((query) => {
          expect(query.kind).toBe('PanelQuery');
          expect(query.spec.query.group).toEqual('theoretical-ds');
          expect(query.spec.query.datasource?.name).toEqual('theoretical-uid');
          expect(query.spec.query.kind).toBe('DataQuery');
        });
      });

      it('respects panel data source', () => {
        const panelDs = {
          type: 'theoretical-ds',
          uid: 'theoretical-uid',
        };
        const targets: DataQuery[] = [
          {
            refId: 'A',
          },
          {
            refId: 'B',
          },
        ];

        const result = getPanelQueries(targets, panelDs);

        expect(result).toHaveLength(targets.length);
        expect(result[0].spec.refId).toBe('A');
        expect(result[1].spec.refId).toBe('B');

        result.forEach((query) => {
          expect(query.kind).toBe('PanelQuery');
          expect(query.spec.query.group).toEqual('theoretical-ds');
          expect(query.spec.query.datasource?.name).toEqual('theoretical-uid');
          expect(query.spec.query.kind).toBe('DataQuery');
        });
      });
    });
  });

  function validateAnnotation(v1: AnnotationQuery, v2: DashboardV2Spec['annotations'][0]) {
    const { spec: v2Spec } = v2;
    expect(v1.name).toBe(v2Spec.name);
    expect(v1.datasource?.type).toBe(v2Spec.query.group);
    expect(v1.datasource?.uid).toBe(v2Spec.query.datasource?.name);
    expect(v1.enable).toBe(v2Spec.enable);
    expect(v1.hide).toBe(v2Spec.hide);
    expect(v1.iconColor).toBe(v2Spec.iconColor);
    expect(v1.builtIn).toBe(v2Spec.builtIn ? 1 : undefined);
    expect(v1.target).toEqual(v2Spec.query.spec);
    expect(v1.filter).toEqual(v2Spec.filter);
  }

  function validatePanel(v1: Panel, v2: PanelKind, layoutV2: GridLayoutKind, panelKey: string) {
    const { spec: v2Spec } = v2;

    expect(v1.id).toBe(v2Spec.id);
    expect(v1.id).toBe(v2Spec.id);
    expect(v1.type).toBe(v2Spec.vizConfig.group);
    expect(v1.title).toBe(v2Spec.title);
    expect(v1.description).toBe(v2Spec.description);
    expect(v1.fieldConfig).toEqual(transformMappingsToV1(v2Spec.vizConfig.spec.fieldConfig));
    expect(v1.options).toBe(v2Spec.vizConfig.spec.options);
    expect(v1.pluginVersion).toBe(v2Spec.vizConfig.version);
    expect(v1.links).toEqual(v2Spec.links);
    expect(v1.targets).toEqual(
      v2Spec.data.spec.queries.map((q) => {
        return {
          refId: q.spec.refId,
          hide: q.spec.hidden,
          datasource: {
            type: q.spec.query.spec.group,
            uid: q.spec.query.spec.datasource?.uid,
          },
          ...q.spec.query.spec,
        };
      })
    );
    expect(v1.transformations).toEqual(v2Spec.data.spec.transformations.map((t) => t.spec));
    const layoutElement = layoutV2.spec.items.find(
      (item) => item.kind === 'GridLayoutItem' && item.spec.element.name === panelKey
    ) as GridLayoutItemKind;
    expect(v1.gridPos?.x).toEqual(layoutElement?.spec.x);
    expect(v1.gridPos?.y).toEqual(layoutElement?.spec.y);
    expect(v1.gridPos?.w).toEqual(layoutElement?.spec.width);
    expect(v1.gridPos?.h).toEqual(layoutElement?.spec.height);

    expect(v1.repeat).toEqual(layoutElement?.spec.repeat?.value);
    expect(v1.repeatDirection).toEqual(layoutElement?.spec.repeat?.direction);
    expect(v1.maxPerRow).toEqual(layoutElement?.spec.repeat?.maxPerRow);

    expect(v1.cacheTimeout).toBe(v2Spec.data.spec.queryOptions.cacheTimeout);
    expect(v1.maxDataPoints).toBe(v2Spec.data.spec.queryOptions.maxDataPoints);
    expect(v1.interval).toBe(v2Spec.data.spec.queryOptions.interval);
    expect(v1.hideTimeOverride).toBe(v2Spec.data.spec.queryOptions.hideTimeOverride);
    expect(v1.queryCachingTTL).toBe(v2Spec.data.spec.queryOptions.queryCachingTTL);
    expect(v1.timeFrom).toBe(v2Spec.data.spec.queryOptions.timeFrom);
    expect(v1.timeShift).toBe(v2Spec.data.spec.queryOptions.timeShift);
    expect(v1.transparent).toBe(v2Spec.transparent);
  }

  function validateVariablesV1ToV2(v2: VariableKind, v1: VariableModel | undefined) {
    if (!v1) {
      return expect(v1).toBeDefined();
    }

    const v1Common = {
      name: v1.name,
      label: v1.label,
      description: v1.description,
      hide: transformVariableHideToEnum(v1.hide),
      skipUrlSync: Boolean(v1.skipUrlSync),
    };

    const v2Common = {
      name: v2.spec.name,
      label: v2.spec.label,
      description: v2.spec.description,
      hide: v2.spec.hide,
      skipUrlSync: v2.spec.skipUrlSync,
    };

    expect(v2Common).toEqual(v1Common);
    if (v2.kind === 'QueryVariable') {
      expect(v2.spec.query).toMatchObject({
        kind: 'DataQuery',
        version: defaultDataQueryKind().version,
        group: (v1.datasource?.type || getDefaultDataSourceRef()?.type) ?? 'grafana',
        ...(v1.datasource?.uid && {
          datasource: {
            name: v1.datasource?.uid,
          },
        }),
      });
      if (typeof v1.query === 'string') {
        expect(v2.spec.query.spec).toEqual({
          [LEGACY_STRING_VALUE_KEY]: v1.query,
        });
      } else {
        expect(v2.spec.query.spec).toEqual({
          ...(typeof v1.query === 'object' ? v1.query : {}),
        });
      }
    }

    if (v2.kind === 'DatasourceVariable') {
      expect(v2.spec.pluginId).toBe(v1.query);
      expect(v2.spec.refresh).toBe(transformVariableRefreshToEnum(v1.refresh));
    }

    if (v2.kind === 'CustomVariable') {
      expect(v2.spec.query).toBe(v1.query);
      expect(v2.spec.options).toEqual(v1.options);
    }

    if (v2.kind === 'AdhocVariable') {
      expect(v2.datasource?.name).toEqual(v1.datasource?.uid);
      expect(v2.group).toEqual(v1.datasource?.type);
      // @ts-expect-error
      expect(v2.spec.filters).toEqual(v1.filters);
      // @ts-expect-error
      expect(v2.spec.baseFilters).toEqual(v1.baseFilters);
    }

    if (v2.kind === 'ConstantVariable') {
      expect(v2.spec.query).toBe(v1.query);
    }

    if (v2.kind === 'IntervalVariable') {
      expect(v2.spec.query).toBe(v1.query);
      expect(v2.spec.options).toEqual(v1.options);
      expect(v2.spec.current).toEqual(v1.current);
      // @ts-expect-error
      expect(v2.spec.auto).toBe(v1.auto);
      // @ts-expect-error
      expect(v2.spec.auto_min).toBe(v1.auto_min);
      // @ts-expect-error
      expect(v2.spec.auto_count).toBe(v1.auto_count);
    }

    if (v2.kind === 'TextVariable') {
      expect(v2.spec.query).toBe(v1.query);
      expect(v2.spec.current).toEqual(v1.current);
    }

    if (v2.kind === 'GroupByVariable') {
      expect(v2.datasource?.name).toEqual(v1.datasource?.uid);
      expect(v2.group).toEqual(v1.datasource?.type);
      expect(v2.spec.options).toEqual(v1.options);
    }
  }
});
