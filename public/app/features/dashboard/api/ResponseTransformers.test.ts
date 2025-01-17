import { AnnotationQuery, DataQuery, Panel } from '@grafana/schema';
import { DashboardV2Spec } from '@grafana/schema/dist/esm/schema/dashboard/v2alpha0';
import { handyTestingSchema } from '@grafana/schema/dist/esm/schema/dashboard/v2alpha0/examples';
import {
  AnnoKeyCreatedBy,
  AnnoKeyDashboardGnetId,
  AnnoKeyDashboardId,
  AnnoKeyFolder,
  AnnoKeySlug,
  AnnoKeyUpdatedBy,
  AnnoKeyUpdatedTimestamp,
} from 'app/features/apiserver/types';
import { getDefaultDataSourceRef } from 'app/features/dashboard-scene/serialization/transformSceneToSaveModelSchemaV2';
import { DashboardDataDTO, DashboardDTO } from 'app/types';

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
          time_options: ['5m', '15m', '1h'],
          nowDelay: '1m',
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
        },
      };

      const transformed = ResponseTransformers.ensureV2Response(dto);

      expect(transformed.apiVersion).toBe('v2alpha1');
      expect(transformed.kind).toBe('DashboardWithAccessInfo');
      expect(transformed.metadata.annotations?.[AnnoKeyCreatedBy]).toEqual('user1');
      expect(transformed.metadata.annotations?.[AnnoKeyUpdatedBy]).toEqual('user2');
      expect(transformed.metadata.annotations?.[AnnoKeyUpdatedTimestamp]).toEqual('2023-01-02T00:00:00Z');
      expect(transformed.metadata.annotations?.[AnnoKeyFolder]).toEqual('folder1');
      expect(transformed.metadata.annotations?.[AnnoKeySlug]).toEqual('dashboard-slug');
      expect(transformed.metadata.annotations?.[AnnoKeyDashboardId]).toBe(123);
      expect(transformed.metadata.annotations?.[AnnoKeyDashboardGnetId]).toBe('something-like-a-uid');

      const spec = transformed.spec;
      expect(spec.title).toBe(dashboardV1.title);
      expect(spec.description).toBe(dashboardV1.description);
      expect(spec.tags).toEqual(dashboardV1.tags);
      expect(spec.schemaVersion).toBe(dashboardV1.schemaVersion);
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
      expect(spec.timeSettings.quickRanges).toEqual(dashboardV1.timepicker?.time_options);
      expect(spec.timeSettings.nowDelay).toBe(dashboardV1.timepicker?.nowDelay);
      expect(spec.timeSettings.fiscalYearStartMonth).toBe(dashboardV1.fiscalYearStartMonth);
      expect(spec.timeSettings.weekStart).toBe(dashboardV1.weekStart);
      expect(spec.links).toEqual(dashboardV1.links);
      expect(spec.annotations).toEqual([]);
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
        apiVersion: 'v2alpha1',
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
          schemaVersion: 1,
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
            quickRanges: ['5m', '15m', '1h'],
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
      expect(dashboard.schemaVersion).toBe(dashboardV2.spec.schemaVersion);
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
      expect(dashboard.timepicker?.time_options).toEqual(dashboardV2.spec.timeSettings.quickRanges);
      expect(dashboard.timepicker?.nowDelay).toBe(dashboardV2.spec.timeSettings.nowDelay);
      expect(dashboard.fiscalYearStartMonth).toBe(dashboardV2.spec.timeSettings.fiscalYearStartMonth);
      expect(dashboard.weekStart).toBe(dashboardV2.spec.timeSettings.weekStart);
      expect(dashboard.links).toEqual(dashboardV2.spec.links);
      // annotations
      validateAnnotation(dashboard.annotations!.list![0], dashboardV2.spec.annotations[0]);
      validateAnnotation(dashboard.annotations!.list![1], dashboardV2.spec.annotations[1]);
      validateAnnotation(dashboard.annotations!.list![2], dashboardV2.spec.annotations[2]);
      validateAnnotation(dashboard.annotations!.list![3], dashboardV2.spec.annotations[3]);
      // panel
      const panelKey = 'panel-1';
      const panelV2 = dashboardV2.spec.elements[panelKey];
      validatePanel(dashboard.panels![0], panelV2, dashboardV2.spec.layout, panelKey);
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
        expect(query.spec.datasource).toEqual({
          type: 'theoretical-ds',
          uid: 'theoretical-uid',
        });
        expect(query.spec.query.kind).toBe('theoretical-ds');
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
        expect(query.spec.datasource).toEqual({
          type: 'theoretical-ds',
          uid: 'theoretical-uid',
        });
        expect(query.spec.query.kind).toBe('theoretical-ds');
      });
    });
  });
});

function validateAnnotation(v1: AnnotationQuery, v2: DashboardV2Spec['annotations'][0]) {
  const { spec: v2Spec } = v2;

  expect(v1.name).toBe(v2Spec.name);
  expect(v1.datasource).toBe(v2Spec.datasource);
  expect(v1.enable).toBe(v2Spec.enable);
  expect(v1.hide).toBe(v2Spec.hide);
  expect(v1.iconColor).toBe(v2Spec.iconColor);
  expect(v1.builtIn).toBe(v2Spec.builtIn ? 1 : 0);
  expect(v1.target).toBe(v2Spec.query?.spec);
  expect(v1.filter).toEqual(v2Spec.filter);
}

function validatePanel(
  v1: Panel,
  v2: DashboardV2Spec['elements'][0],
  layoutV2: DashboardV2Spec['layout'],
  panelKey: string
) {
  const { spec: v2Spec } = v2;

  expect(v1.id).toBe(v2Spec.id);
  expect(v1.type).toBe(v2Spec.vizConfig.kind);
  expect(v1.title).toBe(v2Spec.title);
  expect(v1.description).toBe(v2Spec.description);
  expect(v1.fieldConfig).toEqual(transformMappingsToV1(v2Spec.vizConfig.spec.fieldConfig));
  expect(v1.options).toBe(v2Spec.vizConfig.spec.options);
  expect(v1.pluginVersion).toBe(v2Spec.vizConfig.spec.pluginVersion);
  expect(v1.links).toEqual(v2Spec.links);
  expect(v1.targets).toEqual(
    v2Spec.data.spec.queries.map((q) => {
      return {
        refId: q.spec.refId,
        hide: q.spec.hidden,
        datasource: q.spec.datasource,
        ...q.spec.query.spec,
      };
    })
  );
  expect(v1.transformations).toEqual(v2Spec.data.spec.transformations.map((t) => t.spec));
  const layoutElement = layoutV2.spec.items.find(
    (item) => item.kind === 'GridLayoutItem' && item.spec.element.name === panelKey
  );
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
