import { MetricFindValue, TypedVariableModel } from '@grafana/data';
import { config } from '@grafana/runtime';
import {
  AnnotationQuery,
  DataQuery,
  DataSourceRef,
  Panel,
  RowPanel,
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
  Spec as DashboardV2Spec,
  DataLink,
  DatasourceVariableKind,
  defaultSpec as defaultDashboardV2Spec,
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
  LibraryPanelKind,
  PanelKind,
  GridLayoutItemKind,
  defaultDataQueryKind,
  RowsLayoutRowKind,
  GridLayoutKind,
  defaultDashboardLinkType,
  defaultDashboardLink,
} from '@grafana/schema/dist/esm/schema/dashboard/v2';
import { DashboardLink, DataTransformerConfig } from '@grafana/schema/src/raw/dashboard/x/dashboard_types.gen';
import { isWeekStart, WeekStart } from '@grafana/ui';
import {
  AnnoKeyCreatedBy,
  AnnoKeyDashboardGnetId,
  AnnoKeyDashboardIsSnapshot,
  AnnoKeyDashboardSnapshotOriginalUrl,
  AnnoKeyFolder,
  AnnoKeySlug,
  AnnoKeyUpdatedBy,
  AnnoKeyUpdatedTimestamp,
  DeprecatedInternalId,
  ObjectMeta,
} from 'app/features/apiserver/types';
import { transformV2ToV1AnnotationQuery } from 'app/features/dashboard-scene/serialization/annotations';
import { GRID_ROW_HEIGHT } from 'app/features/dashboard-scene/serialization/const';
import { validateFiltersOrigin } from 'app/features/dashboard-scene/serialization/sceneVariablesSetToVariables';
import { TypedVariableModelV2 } from 'app/features/dashboard-scene/serialization/transformSaveModelSchemaV2ToScene';
import { getDefaultDataSourceRef } from 'app/features/dashboard-scene/serialization/transformSceneToSaveModelSchemaV2';
import {
  transformCursorSyncV2ToV1,
  transformSortVariableToEnumV1,
  transformVariableHideToEnumV1,
  transformVariableRefreshToEnumV1,
} from 'app/features/dashboard-scene/serialization/transformToV1TypesUtils';
import {
  LEGACY_STRING_VALUE_KEY,
  transformCursorSynctoEnum,
  transformDataTopic,
  transformSortVariableToEnum,
  transformVariableHideToEnum,
  transformVariableRefreshToEnum,
} from 'app/features/dashboard-scene/serialization/transformToV2TypesUtils';
import { DashboardDataDTO, DashboardDTO } from 'app/types/dashboard';

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
  let labelsMeta: DashboardWithAccessInfo<DashboardV2Spec>['metadata']['labels'];
  let creationTimestamp;

  if (isDashboardResource(dto)) {
    accessMeta = dto.access;
    annotationsMeta = {
      ...dto.metadata.annotations,
      [AnnoKeyDashboardGnetId]: dashboard.gnetId ?? undefined,
    };
    creationTimestamp = dto.metadata.creationTimestamp;
    labelsMeta = {
      [DeprecatedInternalId]: dto.metadata.labels?.[DeprecatedInternalId],
    };
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
    };
    if (dashboard.gnetId) {
      annotationsMeta[AnnoKeyDashboardGnetId] = dashboard.gnetId;
    }
    if (dto.meta.isSnapshot) {
      // FIXME -- lets not put non-annotation data in annotations!
      annotationsMeta[AnnoKeyDashboardIsSnapshot] = 'true';
    }

    creationTimestamp = dto.meta.created;
    labelsMeta = {
      [DeprecatedInternalId]: dashboard.id?.toString() ?? undefined,
    };
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
    ...(dashboard.liveNow !== undefined && { liveNow: dashboard.liveNow }),
    ...(dashboard.editable !== undefined && { editable: dashboard.editable }),
    ...(dashboard.revision !== undefined && { revision: dashboard.revision }),
    timeSettings: {
      from: dashboard.time?.from || timeSettingsDefaults.from,
      to: dashboard.time?.to || timeSettingsDefaults.to,
      timezone: dashboard.timezone || timeSettingsDefaults.timezone,
      autoRefresh: dashboard.refresh || timeSettingsDefaults.autoRefresh,
      autoRefreshIntervals: dashboard.timepicker?.refresh_intervals || timeSettingsDefaults.autoRefreshIntervals,
      fiscalYearStartMonth: dashboard.fiscalYearStartMonth || timeSettingsDefaults.fiscalYearStartMonth,
      hideTimepicker: dashboard.timepicker?.hidden || timeSettingsDefaults.hideTimepicker,
      ...(dashboard.timepicker?.quick_ranges !== undefined && { quickRanges: dashboard.timepicker.quick_ranges }),
      ...(dashboard.weekStart !== undefined && {
        weekStart: getWeekStart(dashboard.weekStart, timeSettingsDefaults.weekStart),
      }),
      ...(dashboard.timepicker?.nowDelay !== undefined && { nowDelay: dashboard.timepicker.nowDelay }),
    },
    links: (dashboard.links || []).map((link) => ({
      title: link.title ?? defaultDashboardLink().title,
      url: link.url ?? defaultDashboardLink().url,
      type: link.type ?? defaultDashboardLinkType(),
      icon: link.icon ?? defaultDashboardLink().icon,
      tooltip: link.tooltip ?? defaultDashboardLink().tooltip,
      tags: link.tags ?? defaultDashboardLink().tags,
      asDropdown: link.asDropdown ?? defaultDashboardLink().asDropdown,
      keepTime: link.keepTime ?? defaultDashboardLink().keepTime,
      includeVars: link.includeVars ?? defaultDashboardLink().includeVars,
      targetBlank: link.targetBlank ?? defaultDashboardLink().targetBlank,
    })),
    annotations,
    variables,
    elements,
    layout,
  };

  return {
    apiVersion: 'v2beta1',
    kind: 'DashboardWithAccessInfo',
    metadata: {
      creationTimestamp: creationTimestamp || '', // TODO verify this empty string is valid
      name: dashboard.uid,
      resourceVersion: dashboard.version?.toString() || '0',
      annotations: annotationsMeta,
      labels: labelsMeta,
    },
    spec,
    access: accessMeta,
  };
}

export function ensureV1Response(
  dashboard: DashboardDTO | DashboardWithAccessInfo<DashboardV2Spec> | DashboardWithAccessInfo<DashboardDataDTO>
): DashboardDTO {
  // if dashboard is not on v1 schema or v2 schema, return as is
  if (!isDashboardResource(dashboard)) {
    return dashboard;
  }

  const spec = dashboard.spec;
  // if dashboard is on v1 schema
  if (isDashboardV0Spec(spec)) {
    return {
      meta: {
        ...dashboard.access,
        isNew: false,
        isFolder: false,
        uid: dashboard.metadata.name,
        k8s: dashboard.metadata,
        version: dashboard.metadata.generation,
      },
      dashboard: spec,
    };
  } else {
    // if dashboard is on v2 schema convert to v1 schema
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
      dashboard: transformDashboardV2SpecToV1(spec, dashboard.metadata),
    };
  }
}

export const ResponseTransformers = {
  ensureV2Response,
  ensureV1Response,
};

function getElementsFromPanels(
  panels: Array<Panel | RowPanel>
): [DashboardV2Spec['elements'], DashboardV2Spec['layout']] {
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

  if (panels.some(isRowPanel)) {
    return convertToRowsLayout(panels);
  }

  // iterate over panels
  for (const p of panels) {
    const [element, elementName] = buildElement(p);

    elements[elementName] = element;

    layout.spec.items.push(buildGridItemKind(p, elementName));
  }

  return [elements, layout];
}

function convertToRowsLayout(
  panels: Array<Panel | RowPanel>
): [DashboardV2Spec['elements'], DashboardV2Spec['layout']] {
  let currentRow: RowsLayoutRowKind | null = null;
  let legacyRowY = 0;
  const elements: DashboardV2Spec['elements'] = {};
  const layout: DashboardV2Spec['layout'] = {
    kind: 'RowsLayout',
    spec: {
      rows: [],
    },
  };

  for (const p of panels) {
    if (isRowPanel(p)) {
      legacyRowY = p.gridPos!.y;
      if (currentRow) {
        // Flush current row to layout before we create a new one
        layout.spec.rows.push(currentRow);
      }

      // If the row is collapsed it will have panels
      const rowElements = [];
      for (const panel of p.panels || []) {
        const [element, name] = buildElement(panel);
        elements[name] = element;
        rowElements.push(buildGridItemKind(panel, name, yOffsetInRows(panel, legacyRowY)));
      }

      currentRow = buildRowKind(p, rowElements);
    } else {
      const [element, elementName] = buildElement(p);

      elements[elementName] = element;

      if (currentRow) {
        // Collect panels to current layout row
        if (currentRow.spec.layout.kind === 'GridLayout') {
          currentRow.spec.layout.spec.items.push(buildGridItemKind(p, elementName, yOffsetInRows(p, legacyRowY)));
        } else {
          throw new Error('RowsLayoutRow from legacy row must have a GridLayout');
        }
      } else {
        // This is the first row. In V1 these items could live outside of a row. In V2 they will be in a row with header hidden so that it will look similar to V1.
        const grid: GridLayoutKind = {
          kind: 'GridLayout',
          spec: {
            items: [buildGridItemKind(p, elementName)],
          },
        };

        // Since this row does not exist in V1, we simulate it being outside of the grid above the first panel
        // The Y position does not matter for the rows layout, but it's used to calculate the position of the panels in the grid layout in the row.
        legacyRowY = -1;

        currentRow = {
          kind: 'RowsLayoutRow',
          spec: {
            collapse: false,
            title: '',
            hideHeader: true,
            layout: grid,
          },
        };
      }
    }
  }

  if (currentRow) {
    // Flush last row to layout
    layout.spec.rows.push(currentRow);
  }
  return [elements, layout];
}

function isRowPanel(panel: Panel | RowPanel): panel is RowPanel {
  return panel.type === 'row';
}

function getWeekStart(weekStart?: string, defaultWeekStart?: WeekStart): WeekStart | undefined {
  if (!weekStart || !isWeekStart(weekStart)) {
    return defaultWeekStart;
  }
  return weekStart;
}

function buildRowKind(p: RowPanel, elements: GridLayoutItemKind[]): RowsLayoutRowKind {
  return {
    kind: 'RowsLayoutRow',
    spec: {
      collapse: p.collapsed,
      title: p.title ?? '',
      ...(p.repeat ? { repeat: { value: p.repeat, mode: 'variable' } } : {}),
      layout: {
        kind: 'GridLayout',
        spec: {
          items: elements,
        },
      },
    },
  };
}

function buildGridItemKind(p: Panel, elementName: string, yOverride?: number): GridLayoutItemKind {
  return {
    kind: 'GridLayoutItem',
    spec: {
      x: p.gridPos!.x,
      y: yOverride ?? p.gridPos!.y,
      width: p.gridPos!.w,
      height: p.gridPos!.h,
      ...(p.repeat
        ? {
            repeat: {
              value: p.repeat,
              mode: 'variable',
              ...(p.repeatDirection !== undefined && { direction: p.repeatDirection }),
              ...(p.maxPerRow !== undefined && { maxPerRow: p.maxPerRow }),
            },
          }
        : {}),
      element: {
        kind: 'ElementReference',
        name: elementName!,
      },
    },
  };
}

function yOffsetInRows(p: Panel, rowY: number): number {
  return p.gridPos!.y - rowY - GRID_ROW_HEIGHT;
}

function buildElement(p: Panel): [PanelKind | LibraryPanelKind, string] {
  const element_identifier = `panel-${p.id}`;

  if (p.libraryPanel) {
    // LibraryPanelKind
    const panelKind: LibraryPanelKind = {
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

    return [panelKind, element_identifier];
  } else {
    // PanelKind
    const panelKind = buildPanelKind(p);
    return [panelKind, element_identifier];
  }
}

function getDefaultDatasourceType() {
  // if there is no default datasource, return 'grafana' as default
  return getDefaultDataSourceRef()?.type ?? 'grafana';
}

export function getDefaultDatasource(): DataSourceRef {
  const configDefaultDS = getDefaultDataSourceRef() ?? { type: 'grafana', uid: '-- Grafana --' };

  if (configDefaultDS.uid && !configDefaultDS.apiVersion) {
    // get api version from config
    const dsInstance = config.datasources[configDefaultDS.uid];
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
    const ds = t.datasource || panelDatasource;
    const q: PanelQueryKind = {
      kind: 'PanelQuery',
      spec: {
        refId: t.refId,
        hidden: t.hide ?? false,
        query: {
          kind: 'DataQuery',
          version: defaultDataQueryKind().version,
          group: ds.type!,
          ...(ds.uid && {
            datasource: {
              name: ds.uid,
            },
          }),
          spec: {
            ...query,
          },
        },
      },
    };
    return q;
  });
}

export function buildPanelKind(p: Panel): PanelKind {
  const queries = getPanelQueries((p.targets as unknown as DataQuery[]) || [], p.datasource || getDefaultDatasource());

  const transformations = getPanelTransformations(p.transformations || []);

  const panelKind: PanelKind = {
    kind: 'Panel',
    spec: {
      title: p.title || '',
      description: p.description || '',
      vizConfig: {
        kind: 'VizConfig',
        group: p.type,
        version: p.pluginVersion ?? '',
        spec: {
          fieldConfig: {
            defaults: {
              custom: (p.fieldConfig as any) || {},
            },
            overrides: [],
          },
          options: p.options as any,
        },
      },
      links:
        p.links?.map<DataLink>((l) => ({
          title: l.title,
          url: l.url || '',
          ...(l.targetBlank !== undefined && { targetBlank: l.targetBlank }),
        })) || [],
      id: p.id!,
      data: {
        kind: 'QueryGroup',
        spec: {
          queries,
          transformations,
          queryOptions: {
            ...(p.cacheTimeout !== undefined && { cacheTimeout: p.cacheTimeout }),
            ...(p.maxDataPoints !== undefined && { maxDataPoints: p.maxDataPoints }),
            ...(p.interval !== undefined && { interval: p.interval }),
            ...(p.hideTimeOverride !== undefined && { hideTimeOverride: p.hideTimeOverride }),
            ...(p.queryCachingTTL !== undefined && { queryCachingTTL: p.queryCachingTTL }),
            ...(p.timeFrom !== undefined && { timeFrom: p.timeFrom }),
            ...(p.timeShift !== undefined && { timeShift: p.timeShift }),
          },
        },
      },
    },
  };
  return panelKind;
}

function getPanelTransformations(transformations: DataTransformerConfig[]): TransformationKind[] {
  return transformations.map((t) => {
    return {
      kind: t.id,
      spec: {
        ...t,
        ...(t.topic !== undefined && { topic: transformDataTopic(t.topic) }),
      },
    };
  });
}

function getVariables(vars: TypedVariableModel[]): DashboardV2Spec['variables'] {
  const variables: DashboardV2Spec['variables'] = [];
  for (const v of vars) {
    const commonProperties = {
      name: v.name,
      ...(v.label !== undefined && { label: v.label }),
      ...(v.description && { description: v.description }),
      skipUrlSync: Boolean(v.skipUrlSync),
      hide: transformVariableHideToEnum(v.hide),
    };

    let ds: DataSourceRef | undefined;
    let dsType: string | undefined;

    switch (v.type) {
      case 'query':
        let query = v.query || {};

        if (typeof query === 'string') {
          console.warn(
            'Query variable query is a string which is deprecated in the schema v2. It should extend DataQuery'
          );
          query = {
            [LEGACY_STRING_VALUE_KEY]: query,
          };
        }

        const qv: QueryVariableKind = {
          kind: 'QueryVariable',
          spec: {
            ...commonProperties,
            multi: v.multi ?? false,
            includeAll: v.includeAll ?? false,
            ...(v.allValue && { allValue: v.allValue }),
            current: {
              value: v.current?.value,
              text: v.current?.text,
            },
            options: v.options ?? [],
            refresh: transformVariableRefreshToEnum(v.refresh),
            regex: v.regex ?? '',
            sort: v.sort ? transformSortVariableToEnum(v.sort) : 'disabled',
            query: {
              kind: 'DataQuery',
              version: defaultDataQueryKind().version,
              group: v.datasource?.type ?? getDefaultDatasourceType(),
              ...(v.datasource?.uid && {
                datasource: {
                  name: v.datasource.uid,
                },
              }),
              spec: query,
            },
            allowCustomValue: v.allowCustomValue ?? true,
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
            multi: v.multi ?? false,
            includeAll: v.includeAll ?? false,
            ...(v.allValue && { allValue: v.allValue }),
            current: {
              value: v.current.value,
              text: v.current.text,
            },
            options: v.options ?? [],
            refresh: transformVariableRefreshToEnum(v.refresh),
            pluginId,
            regex: v.regex ?? '',
            allowCustomValue: v.allowCustomValue ?? true,
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
            options: v.options ?? [],
            multi: v.multi ?? false,
            includeAll: v.includeAll ?? false,
            ...(v.allValue && { allValue: v.allValue }),
            allowCustomValue: v.allowCustomValue ?? true,
          },
        };
        variables.push(cv);
        break;
      case 'adhoc':
        ds = v.datasource || getDefaultDatasource();
        dsType = ds.type ?? getDefaultDatasourceType();

        const av: AdhocVariableKind = {
          kind: 'AdhocVariable',
          group: dsType,
          ...(ds.uid && {
            datasource: {
              name: ds.uid,
            },
          }),
          spec: {
            ...commonProperties,
            baseFilters: validateFiltersOrigin(v.baseFilters ?? []),
            filters: validateFiltersOrigin(v.filters ?? []),
            defaultKeys:
              v.defaultKeys?.map((key: string | MetricFindValue) =>
                typeof key === 'string' ? { text: key, value: key } : key
              ) ?? [],
            allowCustomValue: v.allowCustomValue ?? true,
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
        ds = v.datasource || getDefaultDatasource();
        dsType = ds.type ?? getDefaultDatasourceType();

        const gb: GroupByVariableKind = {
          kind: 'GroupByVariable',
          group: dsType,
          ...(ds.uid && {
            datasource: {
              name: ds.uid,
            },
          }),
          spec: {
            ...commonProperties,
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
        enable: a.enable,
        hide: Boolean(a.hide),
        iconColor: a.iconColor,
        builtIn: Boolean(a.builtIn),
        query: {
          kind: 'DataQuery',
          version: defaultDataQueryKind().version,
          group: a.datasource?.type || getDefaultDatasourceType(),
          ...(a.datasource?.uid && {
            datasource: {
              name: a.datasource.uid,
            },
          }),
          spec: {
            ...a.target,
          },
        },
        ...(a.filter !== undefined && { filter: a.filter }),
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
          current: {
            text: v.spec.current.text,
            value: v.spec.current.value,
          },
          options: v.spec.options,
          query:
            LEGACY_STRING_VALUE_KEY in v.spec.query.spec
              ? v.spec.query.spec[LEGACY_STRING_VALUE_KEY]
              : v.spec.query.spec,
          datasource: {
            type: v.spec.query?.spec.group,
            uid: v.spec.query?.spec.datasource?.name,
          },
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
          datasource: {
            uid: v.datasource?.name,
            type: v.group,
          },
          current: v.spec.current,
          options: v.spec.options,
        };
        variables.push(gv);
        break;
      case 'AdhocVariable':
        const av: VariableModel = {
          ...commonProperties,
          datasource: {
            uid: v.datasource?.name,
            type: v.group,
          },
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

interface LibraryPanelDTO extends Pick<Panel, 'libraryPanel' | 'id' | 'title' | 'gridPos' | 'type'> {}

function getPanelsV1(
  panels: DashboardV2Spec['elements'],
  layout: DashboardV2Spec['layout']
): Array<Panel | LibraryPanelDTO> {
  const panelsV1: Array<Panel | LibraryPanelDTO | RowPanel> = [];

  let maxPanelId = 0;

  if (layout.kind !== 'GridLayout') {
    throw new Error('Cannot convert non-GridLayout layout to v1');
  }

  for (const item of layout.spec.items) {
    const panel = panels[item.spec.element.name];
    const v1Panel = transformV2PanelToV1Panel(panel, item);
    panelsV1.push(v1Panel);
    if (v1Panel.id ?? 0 > maxPanelId) {
      maxPanelId = v1Panel.id ?? 0;
    }
  }

  // Update row panel ids to be unique
  for (const panel of panelsV1) {
    if (panel.type === 'row' && panel.id === -1) {
      panel.id = ++maxPanelId;
    }
  }
  return panelsV1;
}

function transformV2PanelToV1Panel(
  p: PanelKind | LibraryPanelKind,
  layoutElement: GridLayoutItemKind,
  yOverride?: number
): Panel | LibraryPanelDTO {
  const { x, y, width, height, repeat } = layoutElement?.spec || { x: 0, y: 0, width: 0, height: 0 };
  const gridPos = { x, y: yOverride ?? y, w: width, h: height };
  if (p.kind === 'Panel') {
    const panel = p.spec;
    return {
      id: panel.id,
      type: panel.vizConfig.group,
      title: panel.title,
      description: panel.description,
      fieldConfig: transformMappingsToV1(panel.vizConfig.spec.fieldConfig),
      options: panel.vizConfig.spec.options,
      pluginVersion: panel.vizConfig.version,
      links:
        // @ts-expect-error - Panel link is wrongly typed as DashboardLink
        panel.links?.map<DashboardLink>((l) => ({
          title: l.title,
          url: l.url,
          ...(l.targetBlank !== undefined && { targetBlank: l.targetBlank }),
        })) || [],
      targets: panel.data.spec.queries.map((q) => {
        return {
          refId: q.spec.refId,
          hide: q.spec.hidden,
          datasource: {
            uid: q.spec.query.spec.datasource?.uid,
            type: q.spec.query.spec.group,
          },
          ...q.spec.query.spec,
        };
      }),
      transformations: panel.data.spec.transformations.map((t) => t.spec),
      gridPos,
      ...(panel.data.spec.queryOptions.cacheTimeout !== undefined && {
        cacheTimeout: panel.data.spec.queryOptions.cacheTimeout,
      }),
      ...(panel.data.spec.queryOptions.maxDataPoints !== undefined && {
        maxDataPoints: panel.data.spec.queryOptions.maxDataPoints,
      }),
      ...(panel.data.spec.queryOptions.interval !== undefined && { interval: panel.data.spec.queryOptions.interval }),
      ...(panel.data.spec.queryOptions.hideTimeOverride !== undefined && {
        hideTimeOverride: panel.data.spec.queryOptions.hideTimeOverride,
      }),
      ...(panel.data.spec.queryOptions.queryCachingTTL !== undefined && {
        queryCachingTTL: panel.data.spec.queryOptions.queryCachingTTL,
      }),
      ...(panel.data.spec.queryOptions.timeFrom !== undefined && { timeFrom: panel.data.spec.queryOptions.timeFrom }),
      ...(panel.data.spec.queryOptions.timeShift !== undefined && {
        timeShift: panel.data.spec.queryOptions.timeShift,
      }),
      ...(panel.transparent !== undefined && { transparent: panel.transparent }),
      ...(repeat?.value !== undefined && { repeat: repeat.value }),
      ...(repeat?.direction !== undefined && { repeatDirection: repeat.direction }),
      ...(repeat?.maxPerRow !== undefined && { maxPerRow: repeat.maxPerRow }),
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
      type: 'library-panel-ref',
    };
  } else {
    throw new Error(`Unknown element kind: ${p}`);
  }
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

export function transformDashboardV2SpecToV1(spec: DashboardV2Spec, metadata: ObjectMeta): DashboardDataDTO {
  const annotations = spec.annotations.map(transformV2ToV1AnnotationQuery);

  const variables = getVariablesV1(spec.variables);
  const panels = getPanelsV1(spec.elements, spec.layout);
  return {
    uid: metadata.name,
    title: spec.title,
    description: spec.description,
    tags: spec.tags,
    schemaVersion: 40,
    graphTooltip: transformCursorSyncV2ToV1(spec.cursorSync),
    preload: spec.preload,
    liveNow: spec.liveNow,
    editable: spec.editable,
    gnetId: metadata.annotations?.[AnnoKeyDashboardGnetId],
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
      quick_ranges: spec.timeSettings.quickRanges,
      nowDelay: spec.timeSettings.nowDelay,
    },
    fiscalYearStartMonth: spec.timeSettings.fiscalYearStartMonth,
    weekStart: spec.timeSettings.weekStart,
    version: metadata.generation,
    links: spec.links,
    annotations: { list: annotations },
    panels,
    templating: { list: variables },
  };
}
