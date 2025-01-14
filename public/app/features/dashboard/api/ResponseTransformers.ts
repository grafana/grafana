import { config } from '@grafana/runtime';
import {
  AnnotationQuery,
  DataQuery,
  DataSourceRef,
  Panel,
  VariableModel,
  FieldConfigSource as FieldConfigSourceV1,
  FieldColorModeId as FieldColorModeIdV1,
  ThresholdsMode as ThresholdsModeV1,
  MappingType as MappingTypeV1,
  SpecialValueMatch as SpecialValueMatchV1,
} from '@grafana/schema';
import {
  AnnotationQueryKind,
  DashboardV2Spec,
  DataLink,
  DatasourceVariableKind,
  defaultDashboardV2Spec,
  defaultFieldConfigSource,
  defaultTimeSettingsSpec,
  PanelQueryKind,
  QueryVariableKind,
  TransformationKind,
  FieldColorModeId,
  FieldConfigSource,
  ThresholdsMode,
  SpecialValueMatch,
} from '@grafana/schema/dist/esm/schema/dashboard/v2alpha0/dashboard.gen';
import { DashboardLink, DataTransformerConfig } from '@grafana/schema/src/raw/dashboard/x/dashboard_types.gen';
import {
  AnnoKeyCreatedBy,
  AnnoKeyDashboardGnetId,
  AnnoKeyDashboardId,
  AnnoKeyDashboardIsSnapshot,
  AnnoKeyDashboardSnapshotOriginalUrl,
  AnnoKeyFolder,
  AnnoKeySlug,
  AnnoKeyUpdatedBy,
  AnnoKeyUpdatedTimestamp,
} from 'app/features/apiserver/types';
import { getDefaultDataSourceRef } from 'app/features/dashboard-scene/serialization/transformSceneToSaveModelSchemaV2';
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
import { isDashboardResource, isDashboardV0Spec, isDashboardV2Resource } from './utils';

export function ensureV2Response(
  dto: DashboardDTO | DashboardWithAccessInfo<DashboardDataDTO> | DashboardWithAccessInfo<DashboardV2Spec>
): DashboardWithAccessInfo<DashboardV2Spec> {
  if (isDashboardV2Resource(dto)) {
    return dto;
  }
  let dashboard: DashboardDataDTO;

  if (isDashboardResource(dto)) {
    dashboard = dto.spec;
  } else {
    dashboard = dto.dashboard;
  }

  const timeSettingsDefaults = defaultTimeSettingsSpec();
  const dashboardDefaults = defaultDashboardV2Spec();
  const [elements, layout] = getElementsFromPanels(dashboard.panels || []);
  const variables = getVariables(dashboard.templating?.list || []);
  const annotations = getAnnotations(dashboard.annotations?.list || []);

  let accessMeta: DashboardWithAccessInfo<DashboardV2Spec>['access'];
  let annotationsMeta: DashboardWithAccessInfo<DashboardV2Spec>['metadata']['annotations'];
  let creationTimestamp;

  if (isDashboardResource(dto)) {
    accessMeta = dto.access;
    annotationsMeta = {
      [AnnoKeyCreatedBy]: dto.metadata.annotations?.[AnnoKeyCreatedBy],
      [AnnoKeyUpdatedBy]: dto.metadata.annotations?.[AnnoKeyUpdatedBy],
      [AnnoKeyUpdatedTimestamp]: dto.metadata.annotations?.[AnnoKeyUpdatedTimestamp],
      [AnnoKeyFolder]: dto.metadata.annotations?.[AnnoKeyFolder],
      [AnnoKeySlug]: dto.metadata.annotations?.[AnnoKeySlug],
      [AnnoKeyDashboardId]: dashboard.id ?? undefined,
      [AnnoKeyDashboardGnetId]: dashboard.gnetId ?? undefined,
      [AnnoKeyDashboardIsSnapshot]: dto.metadata.annotations?.[AnnoKeyDashboardIsSnapshot],
    };
    creationTimestamp = dto.metadata.creationTimestamp;
  } else {
    accessMeta = {
      url: dto.meta.url,
      slug: dto.meta.slug,
      canSave: dto.meta.canSave,
      canEdit: dto.meta.canEdit,
      canDelete: dto.meta.canDelete,
      canShare: dto.meta.canShare,
      canStar: dto.meta.canStar,
      canAdmin: dto.meta.canAdmin,
      annotationsPermissions: dto.meta.annotationsPermissions,
    };
    annotationsMeta = {
      [AnnoKeyCreatedBy]: dto.meta.createdBy,
      [AnnoKeyUpdatedBy]: dto.meta.updatedBy,
      [AnnoKeyUpdatedTimestamp]: dto.meta.updated,
      [AnnoKeyFolder]: dto.meta.folderUid,
      [AnnoKeySlug]: dto.meta.slug,
      [AnnoKeyDashboardId]: dashboard.id ?? undefined,
      [AnnoKeyDashboardGnetId]: dashboard.gnetId ?? undefined,
      [AnnoKeyDashboardIsSnapshot]: dto.meta.isSnapshot,
    };
    creationTimestamp = dto.meta.created;
  }

  if (annotationsMeta?.[AnnoKeyDashboardIsSnapshot]) {
    annotationsMeta[AnnoKeyDashboardSnapshotOriginalUrl] = dashboard.snapshot?.originalUrl;
  }

  const spec: DashboardV2Spec = {
    title: dashboard.title,
    description: dashboard.description,
    tags: dashboard.tags ?? [],
    schemaVersion: dashboard.schemaVersion,
    cursorSync: transformCursorSynctoEnum(dashboard.graphTooltip),
    preload: dashboard.preload || dashboardDefaults.preload,
    liveNow: dashboard.liveNow,
    editable: dashboard.editable,
    revision: dashboard.revision,
    timeSettings: {
      from: dashboard.time?.from || timeSettingsDefaults.from,
      to: dashboard.time?.to || timeSettingsDefaults.to,
      timezone: dashboard.timezone || timeSettingsDefaults.timezone,
      autoRefresh: dashboard.refresh || timeSettingsDefaults.autoRefresh,
      autoRefreshIntervals: dashboard.timepicker?.refresh_intervals || timeSettingsDefaults.autoRefreshIntervals,
      fiscalYearStartMonth: dashboard.fiscalYearStartMonth || timeSettingsDefaults.fiscalYearStartMonth,
      hideTimepicker: dashboard.timepicker?.hidden || timeSettingsDefaults.hideTimepicker,
      quickRanges: dashboard.timepicker?.time_options || timeSettingsDefaults.quickRanges,
      weekStart: dashboard.weekStart || timeSettingsDefaults.weekStart,
      nowDelay: dashboard.timepicker?.nowDelay || timeSettingsDefaults.nowDelay,
    },
    links: dashboard.links || [],
    annotations,
    variables,
    elements,
    layout,
  };

  return {
    apiVersion: 'v2alpha1',
    kind: 'DashboardWithAccessInfo',
    metadata: {
      creationTimestamp: creationTimestamp || '', // TODO verify this empty string is valid
      name: dashboard.uid,
      resourceVersion: dashboard.version?.toString() || '0',
      annotations: annotationsMeta,
    },
    spec,
    access: accessMeta,
  };
}

export function ensureV1Response(
  dashboard: DashboardDTO | DashboardWithAccessInfo<DashboardV2Spec> | DashboardWithAccessInfo<DashboardDataDTO>
): DashboardDTO {
  // if dashboard is not on v0 schema or v2 schema, return as is
  if (!isDashboardResource(dashboard)) {
    return dashboard;
  }

  const spec = dashboard.spec;
  // if dashboard is on v0 schema
  if (isDashboardV0Spec(spec)) {
    return {
      meta: {
        ...dashboard.access,
        isNew: false,
        isFolder: false,
        uid: dashboard.metadata.name,
        k8s: dashboard.metadata,
        version: parseInt(dashboard.metadata.resourceVersion, 10),
      },
      dashboard: spec,
    };
  } else {
    // if dashboard is on v2 schema convert to v1 schema
    const annotations = getAnnotationsV1(spec.annotations);
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
        gnetId: dashboard.metadata.annotations?.[AnnoKeyDashboardGnetId],
        revision: spec.revision,
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
        annotations: { list: annotations },
        panels: getPanelsV1(spec.elements, spec.layout), // TODO
        templating: { list: [] }, // TODO
      },
    };
  }
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
    // FIXME: for now we should skip row panels
    if (p.type === 'row') {
      continue;
    }

    const queries = getPanelQueries(
      (p.targets as unknown as DataQuery[]) || [],
      p.datasource || getDefaultDatasource()
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
            fieldConfig: (p.fieldConfig as any) || defaultFieldConfigSource(),
            options: p.options as any,
            pluginVersion: p.pluginVersion!,
          },
        },
        links:
          p.links?.map<DataLink>((l) => ({
            title: l.title,
            url: l.url || '',
            targetBlank: l.targetBlank,
          })) || [],
        id: p.id!,
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
  // if there is no default datasource, return 'grafana' as default
  return getDefaultDataSourceRef()?.type ?? 'grafana';
}

export function getDefaultDatasource(): DataSourceRef {
  const configDefaultDS = getDefaultDataSourceRef() ?? { type: 'grafana', uid: '-- Grafana --' };

  if (configDefaultDS.uid && !configDefaultDS.apiVersion) {
    // get api version from config
    const dsInstance = config.bootData.settings.datasources[configDefaultDS.uid];
    configDefaultDS.apiVersion = dsInstance.apiVersion ?? undefined;
  }

  return {
    apiVersion: configDefaultDS.apiVersion,
    type: configDefaultDS.type,
    uid: configDefaultDS.uid,
  };
}

export function getPanelQueries(targets: DataQuery[], panelDatasource: DataSourceRef): PanelQueryKind[] {
  return targets.map((t) => {
    const { refId, hide, datasource, ...query } = t;
    const q: PanelQueryKind = {
      kind: 'PanelQuery',
      spec: {
        refId: t.refId,
        hidden: t.hide ?? false,
        datasource: t.datasource ? t.datasource : panelDatasource,
        query: {
          kind: t.datasource?.type || panelDatasource.type!,
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
      default:
        // do not throw error, just log it
        console.error(`Variable transformation not implemented: ${v.type}`);
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

function getAnnotationsV1(annotations: DashboardV2Spec['annotations']): AnnotationQuery[] {
  // @ts-expect-error
  // TODO: fix to ensure that spec.query.spec is always a DataQuery
  return annotations.map((a) => {
    return {
      name: a.spec.name,
      datasource: a.spec.datasource,
      enable: a.spec.enable,
      hide: a.spec.hide,
      iconColor: a.spec.iconColor,
      builtIn: a.spec.builtIn,
      target: a.spec.query?.spec,
      filter: a.spec.filter,
    };
  });
}

function getPanelsV1(panels: DashboardV2Spec['elements'], layout: DashboardV2Spec['layout']): Panel[] {
  // TODO: need to get gridPos from layout
  // const gridPos;

  return Object.values(panels).map((p) => {
    const panel = p.spec;
    const gridPos = { x: 0, y: 0, w: 0, h: 0 }; // TODO: get gridPos from layout
    return {
      id: panel.id,
      type: panel.vizConfig.kind,
      title: panel.title,
      description: panel.description,
      fieldConfig: transformMappingsToV1(panel.vizConfig.spec.fieldConfig),
      options: panel.vizConfig.spec.options,
      pluginVersion: panel.vizConfig.spec.pluginVersion,
      links:
        panel.links?.map<DashboardLink>((l) => ({
          title: l.title || '',
          url: l.url || '',
          targetBlank: l.targetBlank || false,
          asDropdown: false,
          icon: '',
          includeVars: false,
          keepTime: false,
          tags: [],
          tooltip: '',
          type: 'link',
        })) || [],
      targets: panel.data.spec.queries.map((q) => {
        return {
          refId: q.spec.refId,
          hide: q.spec.hidden,
          datasource: q.spec.datasource,
          ...q.spec.query.spec,
        };
      }),
      transformations: panel.data.spec.transformations.map((t) => t.spec),
      gridPos,
      cacheTimeout: panel.data.spec.queryOptions.cacheTimeout,
      maxDataPoints: panel.data.spec.queryOptions.maxDataPoints,
      interval: panel.data.spec.queryOptions.interval,
      hideTimeOverride: panel.data.spec.queryOptions.hideTimeOverride,
      queryCachingTTL: panel.data.spec.queryOptions.queryCachingTTL,
      timeFrom: panel.data.spec.queryOptions.timeFrom,
      timeShift: panel.data.spec.queryOptions.timeShift,
    };
  });
}

export function transformMappingsToV1(fieldConfig: FieldConfigSource): FieldConfigSourceV1 {
  const getThresholdsMode = (mode: ThresholdsMode): ThresholdsModeV1 => {
    switch (mode) {
      case 'absolute':
        return ThresholdsModeV1.Absolute;
      case 'percentage':
        return ThresholdsModeV1.Percentage;
      default:
        return ThresholdsModeV1.Absolute;
    }
  };

  const transformedDefaults: any = {
    ...fieldConfig.defaults,
  };

  if (fieldConfig.defaults.mappings) {
    transformedDefaults.mappings = fieldConfig.defaults.mappings.map((mapping) => {
      switch (mapping.type) {
        case 'value':
          return {
            ...mapping,
            type: MappingTypeV1.ValueToText,
          };
        case 'range':
          return {
            ...mapping,
            type: MappingTypeV1.RangeToText,
          };
        case 'regex':
          return {
            ...mapping,
            type: MappingTypeV1.RegexToText,
          };
        case 'special':
          return {
            ...mapping,
            options: {
              ...mapping.options,
              match: transformSpecialValueMatchToV1(mapping.options.match),
            },
            type: MappingTypeV1.SpecialValue,
          };
        default:
          return mapping;
      }
    });
  }

  if (fieldConfig.defaults.thresholds) {
    transformedDefaults.thresholds = {
      ...fieldConfig.defaults.thresholds,
      mode: getThresholdsMode(fieldConfig.defaults.thresholds.mode),
    };
  }

  if (fieldConfig.defaults.color?.mode) {
    transformedDefaults.color = {
      ...fieldConfig.defaults.color,
      mode: colorIdToEnumv1(fieldConfig.defaults.color.mode),
    };
  }

  return {
    ...fieldConfig,
    defaults: transformedDefaults,
  };
}

function colorIdToEnumv1(colorId: FieldColorModeId): FieldColorModeIdV1 {
  switch (colorId) {
    case 'thresholds':
      return FieldColorModeIdV1.Thresholds;
    case 'palette-classic':
      return FieldColorModeIdV1.PaletteClassic;
    case 'palette-classic-by-name':
      return FieldColorModeIdV1.PaletteClassicByName;
    case 'continuous-GrYlRd':
      return FieldColorModeIdV1.ContinuousGrYlRd;
    case 'continuous-RdYlGr':
      return FieldColorModeIdV1.ContinuousRdYlGr;
    case 'continuous-BlYlRd':
      return FieldColorModeIdV1.ContinuousBlYlRd;
    case 'continuous-YlRd':
      return FieldColorModeIdV1.ContinuousYlRd;
    case 'continuous-BlPu':
      return FieldColorModeIdV1.ContinuousBlPu;
    case 'continuous-YlBl':
      return FieldColorModeIdV1.ContinuousYlBl;
    case 'continuous-blues':
      return FieldColorModeIdV1.ContinuousBlues;
    case 'continuous-reds':
      return FieldColorModeIdV1.ContinuousReds;
    case 'continuous-greens':
      return FieldColorModeIdV1.ContinuousGreens;
    case 'continuous-purples':
      return FieldColorModeIdV1.ContinuousPurples;
    case 'fixed':
      return FieldColorModeIdV1.Fixed;
    case 'shades':
      return FieldColorModeIdV1.Shades;
    default:
      return FieldColorModeIdV1.Thresholds;
  }
}

function transformSpecialValueMatchToV1(match: SpecialValueMatch): SpecialValueMatchV1 {
  switch (match) {
    case 'true':
      return SpecialValueMatchV1.True;
    case 'false':
      return SpecialValueMatchV1.False;
    case 'null':
      return SpecialValueMatchV1.Null;
    case 'nan':
      return SpecialValueMatchV1.NaN;
    case 'null+nan':
      return SpecialValueMatchV1.NullAndNan;
    case 'empty':
      return SpecialValueMatchV1.Empty;
    default:
      throw new Error(`Unknown match type: ${match}`);
  }
}
