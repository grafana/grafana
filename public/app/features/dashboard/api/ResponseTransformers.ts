import {
  DashboardV2Spec,
  defaultDashboardV2Spec,
  defaultTimeSettingsSpec,
} from '@grafana/schema/dist/esm/schema/dashboard/v2alpha0/dashboard.gen';
import { transformCursorSynctoEnum } from 'app/features/dashboard-scene/serialization/transformToV2TypesUtils';
import { DashboardDataDTO, DashboardDTO } from 'app/types';

import { DashboardWithAccessInfo } from './types';
import { isDashboardResource, isDashboardV0Spec, isDashboardV2Spec } from './utils';

export function ensureV2Response(
  dto: DashboardDTO | DashboardWithAccessInfo<DashboardDataDTO> | DashboardWithAccessInfo<DashboardV2Spec>
): DashboardWithAccessInfo<DashboardV2Spec> {
  if (isDashboardResource(dto) && isDashboardV2Spec(dto.spec)) {
    return dto as DashboardWithAccessInfo<DashboardV2Spec>;
  }

  // after discarding the dto is not a v2 spec, we can safely assume it's a v0 spec or a dashboardDTO
  dto = dto as unknown as DashboardWithAccessInfo<DashboardDataDTO> | DashboardDTO;

  const timeSettingsDefaults = defaultTimeSettingsSpec();
  const dashboardDefaults = defaultDashboardV2Spec();

  const dashboard = isDashboardResource(dto) ? dto.spec : dto.dashboard;

  const accessAndMeta = isDashboardResource(dto)
    ? {
        ...dto.access,
        created: dto.metadata.creationTimestamp,
        createdBy: dto.metadata.annotations?.['grafana.app/createdBy'],
        updatedBy: dto.metadata.annotations?.['grafana.app/updatedBy'],
        updated: dto.metadata.annotations?.['grafana.app/updatedTimestamp'],
        folderUid: dto.metadata.annotations?.['grafana.app/folder'],
        slug: dto.metadata.annotations?.['grafana.app/slug'],
      }
    : dto.meta;

  const spec: DashboardV2Spec = {
    title: dashboard.title,
    description: dashboard.description,
    tags: dashboard.tags ?? [],
    schemaVersion: dashboard.schemaVersion,
    cursorSync: transformCursorSynctoEnum(dashboard.graphTooltip),
    preload: dashboard.preload || dashboardDefaults.preload,
    liveNow: dashboard.liveNow,
    editable: dashboard.editable,
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
    annotations: [], // TODO
    variables: [], // todo
    elements: {}, // todo
    layout: {
      // todo
      kind: 'GridLayout',
      spec: {
        items: [],
      },
    },
  };

  return {
    apiVersion: 'v2alpha1',
    kind: 'DashboardWithAccessInfo',
    metadata: {
      creationTimestamp: accessAndMeta.created || '', // TODO verify this empty string is valid
      name: dashboard.uid,
      resourceVersion: dashboard.version?.toString() || '0',
      annotations: {
        'grafana.app/createdBy': accessAndMeta.createdBy,
        'grafana.app/updatedBy': accessAndMeta.updatedBy,
        'grafana.app/updatedTimestamp': accessAndMeta.updated,
        'grafana.app/folder': accessAndMeta.folderUid,
        'grafana.app/slug': accessAndMeta.slug,
      },
    },
    spec,
    access: {
      url: accessAndMeta.url || '',
      canAdmin: accessAndMeta.canAdmin,
      canDelete: accessAndMeta.canDelete,
      canEdit: accessAndMeta.canEdit,
      canSave: accessAndMeta.canSave,
      canShare: accessAndMeta.canShare,
      canStar: accessAndMeta.canStar,
      slug: accessAndMeta.slug,
      annotationsPermissions: accessAndMeta.annotationsPermissions,
    },
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
    return {
      meta: {
        created: dashboard.metadata.creationTimestamp,
        createdBy: dashboard.metadata.annotations?.['grafana.app/createdBy'] ?? '',
        updated: dashboard.metadata.annotations?.['grafana.app/updatedTimestamp'],
        updatedBy: dashboard.metadata.annotations?.['grafana.app/updatedBy'],
        folderUid: dashboard.metadata.annotations?.['grafana.app/folder'],
        slug: dashboard.metadata.annotations?.['grafana.app/slug'],
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
        // @ts-ignore TODO: Use transformers for these enums
        //   graphTooltip: spec.cursorSync, // Assuming transformCursorSynctoEnum is reversible
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
        links: spec.links, // Assuming transformDashboardLinksToEnums is reversible
        annotations: { list: [] }, // TODO
      },
    };
  }
}

export const ResponseTransformers = {
  ensureV2Response,
  ensureV1Response,
};
