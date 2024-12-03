import { config } from '@grafana/runtime';
import { AnnotationQuery, DataQuery, Panel, VariableModel } from '@grafana/schema';
import {
  AnnotationQueryKind,
  DashboardV2Spec,
  DatasourceVariableKind,
  defaultDashboardV2Spec,
  defaultTimeSettingsSpec,
  PanelQueryKind,
  QueryVariableKind,
  TransformationKind,
} from '@grafana/schema/dist/esm/schema/dashboard/v2alpha0/dashboard.gen';
import { DataTransformerConfig } from '@grafana/schema/src/raw/dashboard/x/dashboard_types.gen';
import {
  AnnoKeyCreatedBy,
  AnnoKeyFolder,
  AnnoKeySlug,
  AnnoKeyUpdatedBy,
  AnnoKeyUpdatedTimestamp,
} from 'app/features/apiserver/types';
import { transformCursorSyncV2ToV1 } from 'app/features/dashboard-scene/serialization/transformToV1TypesUtils';
import {
  transformCursorSynctoEnum,
  transformDataTopic,
  transformSortVariableToEnum,
  transformVariableHideToEnum,
  transformVariableRefreshToEnum,
} from 'app/features/dashboard-scene/serialization/transformToV2TypesUtils';
import { DashboardDataDTO, DashboardDTO } from 'app/types';

import { DashboardWithAccessInfo } from './types';
import { isDashboardResource, isDashboardV2Spec } from './utils';

export function ensureV2Response(
  dto: DashboardWithAccessInfo<DashboardV2Spec | DashboardDataDTO>
): DashboardWithAccessInfo<DashboardV2Spec> {
  const spec = dto.spec;

  if (!isDashboardResource(dto)) {
    throw new Error('Invalid dashboard resource');
  }

  // return as is if already v2
  if (isDashboardV2Spec(spec)) {
    return dto;
  }

  const timeSettingsDefaults = defaultTimeSettingsSpec();
  const dashboardDefaults = defaultDashboardV2Spec();
  const [elements, layout] = getElementsFromPanels(spec.panels || []);
  const variables = getVariables(spec.templating?.list || []);
  const annotations = getAnnotations(spec.annotations?.list || []);

  const result: DashboardV2Spec = {
    title: spec.title,
    description: spec.description,
    tags: spec.tags,
    schemaVersion: spec.schemaVersion,
    cursorSync: transformCursorSynctoEnum(spec.graphTooltip),
    preload: spec.preload || dashboardDefaults.preload,
    liveNow: spec.liveNow,
    editable: spec.editable,
    timeSettings: {
      from: spec.time?.from || timeSettingsDefaults.from,
      to: spec.time?.to || timeSettingsDefaults.to,
      timezone: spec.timezone || timeSettingsDefaults.timezone,
      autoRefresh: spec.refresh || timeSettingsDefaults.autoRefresh,
      autoRefreshIntervals: spec.timepicker?.refresh_intervals || timeSettingsDefaults.autoRefreshIntervals,
      fiscalYearStartMonth: spec.fiscalYearStartMonth || timeSettingsDefaults.fiscalYearStartMonth,
      hideTimepicker: spec.timepicker?.hidden || timeSettingsDefaults.hideTimepicker,
      quickRanges: spec.timepicker?.time_options || timeSettingsDefaults.quickRanges,
      weekStart: spec.weekStart || timeSettingsDefaults.weekStart,
      nowDelay: spec.timepicker?.nowDelay || timeSettingsDefaults.nowDelay,
    },
    links: spec.links || [],
    annotations,
    variables,
    elements,
    layout,
  };

  return {
    ...dto,
    spec: result,
  };
}

export function ensureV1Response(dashboard: DashboardWithAccessInfo<DashboardV2Spec> | DashboardDTO): DashboardDTO {
  if (!isDashboardResource(dashboard)) {
    return dashboard;
  }

  const spec = dashboard.spec;

  return {
    meta: {
      created: dashboard.metadata.creationTimestamp,
      createdBy: dashboard.metadata.annotations?.[AnnoKeyCreatedBy] ?? '',
      updated: dashboard.metadata.annotations?.[AnnoKeyUpdatedTimestamp],
      updatedBy: dashboard.metadata.annotations?.[AnnoKeyUpdatedBy],
      folderUid: dashboard.metadata.annotations?.[AnnoKeyFolder],
      slug: dashboard.metadata.annotations?.[AnnoKeySlug],
      url: dashboard.access.url,
      canAdmin: dashboard.access.canAdmin,
      canDelete: dashboard.access.canDelete,
      canEdit: dashboard.access.canEdit,
      canSave: dashboard.access.canSave,
      canShare: dashboard.access.canShare,
      canStar: dashboard.access.canStar,
      annotationsPermissions: dashboard.access.annotationsPermissions,
    },
    dashboard: {
      uid: dashboard.metadata.name,
      title: spec.title,
      description: spec.description,
      tags: spec.tags,
      schemaVersion: spec.schemaVersion,
      graphTooltip: transformCursorSyncV2ToV1(spec.cursorSync),
      preload: spec.preload,
      liveNow: spec.liveNow,
      editable: spec.editable,
      time: {
        from: spec.timeSettings.from,
        to: spec.timeSettings.to,
      },
      timezone: spec.timeSettings.timezone,
      refresh: spec.timeSettings.autoRefresh,
      timepicker: {
        refresh_intervals: spec.timeSettings.autoRefreshIntervals,
        hidden: spec.timeSettings.hideTimepicker,
        time_options: spec.timeSettings.quickRanges,
        nowDelay: spec.timeSettings.nowDelay,
      },
      fiscalYearStartMonth: spec.timeSettings.fiscalYearStartMonth,
      weekStart: spec.timeSettings.weekStart,
      version: parseInt(dashboard.metadata.resourceVersion, 10),
      links: spec.links,
      // TODO[schema v2]: handle annotations
      annotations: { list: [] },
      // TODO[schema v2]: handle panels
      panels: [],
      // TODO[schema v2]: handle variables
      templating: {
        list: [],
      },
      // TODO[schema v2]: handle id
      // id: 0,
      // TODO[schema v2]: handle revision
      // revision: 0,
      // TODO[schema v2]: handle variables
      // gnetId
    },
  };
}

export const ResponseTransformers = {
  ensureV2Response,
  ensureV1Response,
};

// TODO[schema v2]: handle rows
function getElementsFromPanels(panels: Panel[]): [DashboardV2Spec['elements'], DashboardV2Spec['layout']] {
  const elements: DashboardV2Spec['elements'] = {};
  const layout: DashboardV2Spec['layout'] = {
    kind: 'GridLayout',
    spec: {
      items: [],
    },
  };

  if (!panels) {
    return [elements, layout];
  }

  // iterate over panels
  for (const p of panels) {
    const queries = getPanelQueries(
      (p.targets as unknown as DataQuery[]) || [],
      p.datasource?.type || getDefaultDatasourceType()
    );

    const transformations = getPanelTransformations(p.transformations || []);

    elements[p.id!] = {
      kind: 'Panel',
      spec: {
        title: p.title || '',
        description: p.description || '',
        vizConfig: {
          kind: p.type,
          spec: {
            fieldConfig: p.fieldConfig as any,
            options: p.options as any,
            pluginVersion: p.pluginVersion!,
          },
        },
        links: p.links || [],
        uid: p.id!.toString(), // TODO[schema v2]: handle undefined id?!!?!?
        data: {
          kind: 'QueryGroup',
          spec: {
            queries,
            transformations, // TODO[schema v2]: handle transformations
            queryOptions: {
              cacheTimeout: p.cacheTimeout,
              maxDataPoints: p.maxDataPoints,
              interval: p.interval,
              hideTimeOverride: p.hideTimeOverride,
              queryCachingTTL: p.queryCachingTTL,
              timeFrom: p.timeFrom,
              timeShift: p.timeShift,
            },
          },
        },
      },
    };

    layout.spec.items.push({
      kind: 'GridLayoutItem',
      spec: {
        x: p.gridPos!.x,
        y: p.gridPos!.y,
        width: p.gridPos!.w,
        height: p.gridPos!.h,
        element: {
          kind: 'ElementReference',
          name: p.id!.toString(),
        },
      },
    });
  }

  return [elements, layout];
}

function getDefaultDatasourceType() {
  const datasources = config.datasources;
  // find default datasource in datasources
  return Object.values(datasources).find((ds) => ds.isDefault)!.type;
}

function getPanelQueries(targets: DataQuery[], panelDatasourceType: string): PanelQueryKind[] {
  return targets.map((t) => {
    const { refId, hide, datasource, ...query } = t;
    const q: PanelQueryKind = {
      kind: 'PanelQuery',
      spec: {
        refId: t.refId,
        hidden: t.hide ?? false,
        // TODO[schema v2]: ds coming from panel ?!?!!?! AAAAAAAAAAAAA! Send help!
        datasource: t.datasource ? t.datasource : undefined,
        query: {
          kind: t.datasource?.type || panelDatasourceType,
          spec: {
            ...query,
          },
        },
      },
    };
    return q;
  });
}

function getPanelTransformations(transformations: DataTransformerConfig[]): TransformationKind[] {
  return transformations.map((t) => {
    return {
      kind: t.id,
      spec: {
        ...t,
        topic: transformDataTopic(t.topic),
      },
    };
  });
}

function getVariables(vars: VariableModel[]): DashboardV2Spec['variables'] {
  const variables: DashboardV2Spec['variables'] = [];
  for (const v of vars) {
    switch (v.type) {
      case 'query':
        let query = v.query || {};

        if (typeof query === 'string') {
          console.error('Query variable query is a string. It needs to extend DataQuery.');
          query = {};
        }

        const qv: QueryVariableKind = {
          kind: 'QueryVariable',
          spec: {
            name: v.name,
            label: v.label,
            hide: transformVariableHideToEnum(v.hide),
            skipUrlSync: Boolean(v.skipUrlSync),
            multi: Boolean(v.multi),
            includeAll: Boolean(v.includeAll),
            allValue: v.allValue,
            current: v.current || { text: '', value: '' },
            options: v.options || [],
            refresh: transformVariableRefreshToEnum(v.refresh),
            datasource: v.datasource ?? undefined,
            regex: v.regex || '',
            sort: transformSortVariableToEnum(v.sort),
            query: {
              kind: v.datasource?.type || getDefaultDatasourceType(),
              spec: {
                ...query,
              },
            },
          },
        };
        variables.push(qv);
        break;
      case 'datasource':
        let pluginId = getDefaultDatasourceType();

        if (v.query && typeof v.query === 'string') {
          pluginId = v.query;
        }

        const dv: DatasourceVariableKind = {
          kind: 'DatasourceVariable',
          spec: {
            name: v.name,
            label: v.label,
            hide: transformVariableHideToEnum(v.hide),
            skipUrlSync: Boolean(v.skipUrlSync),
            multi: Boolean(v.multi),
            includeAll: Boolean(v.includeAll),
            allValue: v.allValue,
            current: v.current || { text: '', value: '' },
            options: v.options || [],
            refresh: transformVariableRefreshToEnum(v.refresh),
            pluginId,
            regex: v.regex || '',
            description: v.description || '',
          },
        };
        variables.push(dv);
        break;
    }
  }
  return variables;
}

function getAnnotations(annotations: AnnotationQuery[]): DashboardV2Spec['annotations'] {
  return annotations.map((a) => {
    const aq: AnnotationQueryKind = {
      kind: 'AnnotationQuery',
      spec: {
        name: a.name,
        datasource: a.datasource ?? undefined,
        enable: a.enable,
        hide: Boolean(a.hide),
        iconColor: a.iconColor,
        builtIn: Boolean(a.builtIn),
        query: {
          kind: a.datasource?.type || getDefaultDatasourceType(),
          spec: {
            ...a.target,
          },
        },
        filter: a.filter,
      },
    };
    return aq;
  });
}
