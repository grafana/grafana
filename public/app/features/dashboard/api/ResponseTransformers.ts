import { TypedVariableModel } from '@grafana/data';
import { config } from '@grafana/runtime';
import {
  AnnotationQuery,
  DataQuery,
  DataSourceRef,
  Panel,
  VariableModel,
  VariableType,
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
  AdhocVariableKind,
  CustomVariableKind,
  ConstantVariableKind,
  IntervalVariableKind,
  TextVariableKind,
  GroupByVariableKind,
} from '@grafana/schema/dist/esm/schema/dashboard/v2alpha0';
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
import { TypedVariableModelV2 } from 'app/features/dashboard-scene/serialization/transformSaveModelSchemaV2ToScene';
import { getDefaultDataSourceRef } from 'app/features/dashboard-scene/serialization/transformSceneToSaveModelSchemaV2';
import {
  transformCursorSyncV2ToV1,
  transformSortVariableToEnumV1,
  transformVariableHideToEnumV1,
  transformVariableRefreshToEnumV1,
} from 'app/features/dashboard-scene/serialization/transformToV1TypesUtils';
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
  // @ts-expect-error - dashboard.templating.list is VariableModel[] and we need TypedVariableModel[] here
  // that would allow accessing unique properties for each variable type that the API returns
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
    const variables = getVariablesV1(spec.variables);
    const panels = getPanelsV1(spec.elements, spec.layout);
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
        schemaVersion: 40,
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
        panels,
        templating: { list: variables },
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
    const elementName = p.id!.toString();

    // LibraryPanelKind
    if (p.libraryPanel) {
      elements[elementName] = {
        kind: 'LibraryPanel',
        spec: {
          libraryPanel: {
            uid: p.libraryPanel.uid,
            name: p.libraryPanel.name,
          },
          id: p.id!,
          title: p.title ?? '',
        },
      };
      // PanelKind
    } else {
      // FIXME: for now we should skip row panels
      if (p.type === 'row') {
        continue;
      }

      const queries = getPanelQueries(
        (p.targets as unknown as DataQuery[]) || [],
        p.datasource || getDefaultDatasource()
      );
      const transformations = getPanelTransformations(p.transformations || []);

      elements[elementName] = {
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
    }

    layout.spec.items.push({
      kind: 'GridLayoutItem',
      spec: {
        x: p.gridPos!.x,
        y: p.gridPos!.y,
        width: p.gridPos!.w,
        height: p.gridPos!.h,
        element: {
          kind: 'ElementReference',
          name: elementName,
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

function getVariables(vars: TypedVariableModel[]): DashboardV2Spec['variables'] {
  const variables: DashboardV2Spec['variables'] = [];
  for (const v of vars) {
    const commonProperties = {
      name: v.name,
      label: v.label,
      ...(v.description && { description: v.description }),
      skipUrlSync: Boolean(v.skipUrlSync),
      hide: transformVariableHideToEnum(v.hide),
    };

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
            ...commonProperties,
            multi: Boolean(v.multi),
            includeAll: Boolean(v.includeAll),
            ...(v.allValue && { allValue: v.allValue }),
            current: {
              value: v.current.value,
              text: v.current.text,
            },
            options: v.options || [],
            refresh: transformVariableRefreshToEnum(v.refresh),
            ...(v.datasource && { datasource: v.datasource }),
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
            ...commonProperties,
            multi: Boolean(v.multi),
            includeAll: Boolean(v.includeAll),
            ...(v.allValue && { allValue: v.allValue }),
            current: {
              value: v.current.value,
              text: v.current.text,
            },
            options: v.options || [],
            refresh: transformVariableRefreshToEnum(v.refresh),
            pluginId,
            regex: v.regex || '',
          },
        };
        variables.push(dv);
        break;
      case 'custom':
        const cv: CustomVariableKind = {
          kind: 'CustomVariable',
          spec: {
            ...commonProperties,
            query: v.query,
            current: {
              value: v.current.value,
              text: v.current.text,
            },
            options: v.options,
            multi: v.multi,
            includeAll: v.includeAll,
            ...(v.allValue && { allValue: v.allValue }),
          },
        };
        variables.push(cv);
        break;
      case 'adhoc':
        const av: AdhocVariableKind = {
          kind: 'AdhocVariable',
          spec: {
            ...commonProperties,
            datasource: v.datasource || getDefaultDatasource(),
            baseFilters: v.baseFilters || [],
            filters: v.filters || [],
            defaultKeys: v.defaultKeys || [],
          },
        };
        variables.push(av);
        break;
      case 'constant':
        const cnts: ConstantVariableKind = {
          kind: 'ConstantVariable',
          spec: {
            ...commonProperties,
            current: {
              value: v.current.value,
              // Constant variable doesn't use text state
              text: v.current.value,
            },
            query: v.query,
          },
        };
        variables.push(cnts);
        break;
      case 'interval':
        const intrv: IntervalVariableKind = {
          kind: 'IntervalVariable',
          spec: {
            ...commonProperties,
            current: {
              value: v.current.value,
              // Interval variable doesn't use text state
              text: v.current.value,
            },
            query: v.query,
            refresh: 'onTimeRangeChanged',
            options: v.options,
            auto: v.auto,
            auto_min: v.auto_min,
            auto_count: v.auto_count,
          },
        };
        variables.push(intrv);
        break;
      case 'textbox':
        const tx: TextVariableKind = {
          kind: 'TextVariable',
          spec: {
            ...commonProperties,
            current: {
              value: v.current.value,
              // Text variable doesn't use text state
              text: v.current.value,
            },
            query: v.query,
          },
        };
        variables.push(tx);
        break;
      case 'groupby':
        const gb: GroupByVariableKind = {
          kind: 'GroupByVariable',
          spec: {
            ...commonProperties,
            datasource: v.datasource || getDefaultDatasource(),
            options: v.options,
            current: {
              value: v.current.value,
              text: v.current.text,
            },
            multi: v.multi,
          },
        };
        variables.push(gb);
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
        ...(a.datasource && { datasource: a.datasource }),
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

function getVariablesV1(vars: DashboardV2Spec['variables']): VariableModel[] {
  const variables: VariableModel[] = [];

  for (const v of vars) {
    const commonProperties = {
      name: v.spec.name,
      label: v.spec.label,
      ...(v.spec.description && { description: v.spec.description }),
      skipUrlSync: v.spec.skipUrlSync,
      hide: transformVariableHideToEnumV1(v.spec.hide),
      type: transformToV1VariableTypes(v),
    };

    switch (v.kind) {
      case 'QueryVariable':
        const qv: VariableModel = {
          ...commonProperties,
          current: v.spec.current,
          options: v.spec.options,
          query: typeof v.spec.query === 'string' ? v.spec.query : v.spec.query.spec,
          datasource: v.spec.datasource,
          sort: transformSortVariableToEnumV1(v.spec.sort),
          refresh: transformVariableRefreshToEnumV1(v.spec.refresh),
          regex: v.spec.regex,
          allValue: v.spec.allValue,
          includeAll: v.spec.includeAll,
          multi: v.spec.multi,
          // @ts-expect-error - definition is not part of v1 VariableModel
          definition: v.spec.definition,
        };
        variables.push(qv);
        break;
      case 'DatasourceVariable':
        const dv: VariableModel = {
          ...commonProperties,
          current: v.spec.current,
          options: [],
          regex: v.spec.regex,
          refresh: transformVariableRefreshToEnumV1(v.spec.refresh),
          query: v.spec.pluginId,
          multi: v.spec.multi,
          allValue: v.spec.allValue,
          includeAll: v.spec.includeAll,
        };
        variables.push(dv);
        break;
      case 'CustomVariable':
        const cv: VariableModel = {
          ...commonProperties,
          current: {
            text: v.spec.current.value,
            value: v.spec.current.value,
          },
          options: v.spec.options,
          query: v.spec.query,
          multi: v.spec.multi,
          allValue: v.spec.allValue,
          includeAll: v.spec.includeAll,
        };
        variables.push(cv);
        break;
      case 'ConstantVariable':
        const constant: VariableModel = {
          ...commonProperties,
          current: {
            text: v.spec.current.value,
            value: v.spec.current.value,
          },
          hide: transformVariableHideToEnumV1(v.spec.hide),
          // @ts-expect-error
          query: v.spec.current.value,
        };
        variables.push(constant);
        break;
      case 'IntervalVariable':
        const iv: VariableModel = {
          ...commonProperties,
          current: {
            text: v.spec.current.value,
            value: v.spec.current.value,
          },
          hide: transformVariableHideToEnumV1(v.spec.hide),
          query: v.spec.query,
          refresh: transformVariableRefreshToEnumV1(v.spec.refresh),
          options: v.spec.options,
          // @ts-expect-error
          auto: v.spec.auto,
          auto_min: v.spec.auto_min,
          auto_count: v.spec.auto_count,
        };
        variables.push(iv);
        break;
      case 'TextVariable':
        const current = {
          text: v.spec.current.value,
          value: v.spec.current.value,
        };

        const tv: VariableModel = {
          ...commonProperties,
          current: {
            text: v.spec.current.value,
            value: v.spec.current.value,
          },
          options: [{ ...current, selected: true }],
          query: v.spec.query,
        };
        variables.push(tv);
        break;
      case 'GroupByVariable':
        const gv: VariableModel = {
          ...commonProperties,
          datasource: v.spec.datasource,
          current: v.spec.current,
          options: v.spec.options,
        };
        variables.push(gv);
        break;
      case 'AdhocVariable':
        const av: VariableModel = {
          ...commonProperties,
          datasource: v.spec.datasource,
          // @ts-expect-error
          baseFilters: v.spec.baseFilters,
          filters: v.spec.filters,
          defaultKeys: v.spec.defaultKeys,
        };
        variables.push(av);
        break;
      default:
        // do not throw error, just log it
        console.error(`Variable transformation not implemented: ${v}`);
    }
  }
  return variables;
}

function getAnnotationsV1(annotations: DashboardV2Spec['annotations']): AnnotationQuery[] {
  // @ts-expect-error - target v2 query is not compatible with v1 target
  return annotations.map((a) => {
    return {
      name: a.spec.name,
      datasource: a.spec.datasource,
      enable: a.spec.enable,
      hide: a.spec.hide,
      iconColor: a.spec.iconColor,
      builtIn: a.spec.builtIn ? 1 : 0,
      target: a.spec.query?.spec,
      filter: a.spec.filter,
    };
  });
}

interface LibraryPanelDTO extends Pick<Panel, 'libraryPanel' | 'id' | 'title' | 'gridPos'> {}

function getPanelsV1(
  panels: DashboardV2Spec['elements'],
  layout: DashboardV2Spec['layout']
): Array<Panel | LibraryPanelDTO> {
  return Object.entries(panels).map(([key, p]) => {
    const layoutElement = layout.spec.items.find(
      (item) => item.kind === 'GridLayoutItem' && item.spec.element.name === key
    );
    const { x, y, width, height, repeat } = layoutElement?.spec || { x: 0, y: 0, width: 0, height: 0 };
    const gridPos = { x, y, w: width, h: height };
    if (p.kind === 'Panel') {
      const panel = p.spec;
      return {
        id: panel.id,
        type: panel.vizConfig.kind,
        title: panel.title,
        description: panel.description,
        fieldConfig: transformMappingsToV1(panel.vizConfig.spec.fieldConfig),
        options: panel.vizConfig.spec.options,
        pluginVersion: panel.vizConfig.spec.pluginVersion,
        links:
          // @ts-expect-error - Panel link is wrongly typed as DashboardLink
          panel.links?.map<DashboardLink>((l) => ({
            title: l.title,
            url: l.url,
            ...(l.targetBlank && { targetBlank: l.targetBlank }),
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
        transparent: panel.transparent,
        ...(repeat?.value && { repeat: repeat.value }),
        ...(repeat?.direction && { repeatDirection: repeat.direction }),
        ...(repeat?.maxPerRow && { maxPerRow: repeat.maxPerRow }),
      };
    } else if (p.kind === 'LibraryPanel') {
      const panel = p.spec;
      return {
        id: panel.id,
        title: panel.title,
        gridPos,
        libraryPanel: {
          uid: panel.libraryPanel.uid,
          name: panel.libraryPanel.name,
        },
      };
    } else {
      throw new Error(`Unknown element kind: ${p}`);
    }
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

function transformToV1VariableTypes(variable: TypedVariableModelV2): VariableType {
  switch (variable.kind) {
    case 'QueryVariable':
      return 'query';
    case 'DatasourceVariable':
      return 'datasource';
    case 'CustomVariable':
      return 'custom';
    case 'ConstantVariable':
      return 'constant';
    case 'IntervalVariable':
      return 'interval';
    case 'TextVariable':
      return 'textbox';
    case 'GroupByVariable':
      return 'groupby';
    case 'AdhocVariable':
      return 'adhoc';
    default:
      throw new Error(`Unknown variable type: ${variable}`);
  }
}
