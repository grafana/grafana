import {
  DashboardV2Spec,
  defaultDashboardV2Spec,
  defaultTimeSettingsSpec,
} from '@grafana/schema/dist/esm/schema/dashboard/v2alpha0/dashboard.gen';
import { transformCursorSynctoEnum } from 'app/features/dashboard-scene/serialization/transformToV2TypesUtils';
import { DashboardDataDTO, DashboardDTO } from 'app/types';

import { DashboardWithAccessInfo } from './types';

export function ensureV1ResponseFromV0(dto: DashboardWithAccessInfo<DashboardDataDTO>): DashboardDTO {
  const result: DashboardDTO = {
    meta: {
      ...dto.access,
      isNew: false,
      isFolder: false,
      uid: dto.metadata.name,
      k8s: dto.metadata,
    },
    dashboard: dto.spec,
  };

  return result;
}

export function ensureV2Response(dto: DashboardDTO): DashboardWithAccessInfo<DashboardV2Spec> {
  const timeSettingsDefaults = defaultTimeSettingsSpec();
  const dashboardDefaults = defaultDashboardV2Spec();

  const spec: DashboardV2Spec = {
    title: dto.dashboard.title,
    description: dto.dashboard.description,
    tags: dto.dashboard.tags,
    schemaVersion: dto.dashboard.schemaVersion,
    cursorSync: transformCursorSynctoEnum(dto.dashboard.graphTooltip),
    preload: dto.dashboard.preload || dashboardDefaults.preload,
    liveNow: dto.dashboard.liveNow,
    editable: dto.dashboard.editable,
    timeSettings: {
      from: dto.dashboard.time?.from || timeSettingsDefaults.from,
      to: dto.dashboard.time?.to || timeSettingsDefaults.to,
      timezone: dto.dashboard.timezone || timeSettingsDefaults.timezone,
      autoRefresh: dto.dashboard.refresh || timeSettingsDefaults.autoRefresh,
      autoRefreshIntervals: dto.dashboard.timepicker?.refresh_intervals || timeSettingsDefaults.autoRefreshIntervals,
      fiscalYearStartMonth: dto.dashboard.fiscalYearStartMonth || timeSettingsDefaults.fiscalYearStartMonth,
      hideTimepicker: dto.dashboard.timepicker?.hidden || timeSettingsDefaults.hideTimepicker,
      quickRanges: dto.dashboard.timepicker?.time_options || timeSettingsDefaults.quickRanges,
      weekStart: dto.dashboard.weekStart || timeSettingsDefaults.weekStart,
      nowDelay: dto.dashboard.timepicker?.nowDelay || timeSettingsDefaults.nowDelay,
    },
    links: dto.dashboard.links || [],
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
      creationTimestamp: dto.meta.created || '', // TODO verify this empty string is valid
      name: dto.dashboard.uid,
      resourceVersion: dto.dashboard.version?.toString() || '0',
      annotations: {
        'grafana.app/createdBy': dto.meta.createdBy,
        'grafana.app/updatedBy': dto.meta.updatedBy,
        'grafana.app/updatedTimestamp': dto.meta.updated,
        'grafana.app/folder': dto.meta.folderUid,
        'grafana.app/slug': dto.meta.slug,
      },
    },
    spec,
    access: {
      url: dto.meta.url || '',
      canAdmin: dto.meta.canAdmin,
      canDelete: dto.meta.canDelete,
      canEdit: dto.meta.canEdit,
      canSave: dto.meta.canSave,
      canShare: dto.meta.canShare,
      canStar: dto.meta.canStar,
      slug: dto.meta.slug,
      annotationsPermissions: dto.meta.annotationsPermissions,
    },
  };
}

export function ensureV1Response(dashboard: DashboardWithAccessInfo<DashboardV2Spec>): DashboardDTO {
  const spec = dashboard.spec;

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

export const ResponseTransformers = {
  ensureV2Response,
  ensureV1Response,
  ensureV1ResponseFromV0,
};
