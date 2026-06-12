import { t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { type VariableModel, defaultDashboard } from '@grafana/schema';
import {
  type AdhocVariableKind,
  defaultAdhocVariableSpec,
  defaultSpec as defaultDashboardV2Spec,
  defaultGroupByVariableSpec,
  defaultTimeSettingsSpec,
  type GroupByVariableKind,
  type Spec as DashboardV2Spec,
  defaultGridLayoutKind,
} from '@grafana/schema/apis/dashboard.grafana.app/v2';
import {
  AnnoKeyCreatedBy,
  AnnoKeyFolder,
  AnnoKeyFolderTitle,
  AnnoKeyMessage,
  AnnoKeyUpdatedBy,
  AnnoKeyUpdatedTimestamp,
} from 'app/features/apiserver/types';
import { dashboardAPIVersionResolver } from 'app/features/dashboard/api/DashboardAPIVersionResolver';
import { getDashboardAPI } from 'app/features/dashboard/api/dashboard_api';
import { type DashboardWithAccessInfo } from 'app/features/dashboard/api/types';
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';
import { type DashboardDTO } from 'app/types/dashboard';

import { contextSrv } from '../../../core/services/context_srv';

export async function buildNewDashboardSaveModel(urlFolderUid?: string): Promise<DashboardDTO> {
  let variablesList = defaultDashboard.templating?.list;

  if (config.featureToggles.newDashboardWithFiltersAndGroupBy) {
    // Add filter and group by variables if the datasource supports it
    const defaultDs = await getDatasourceSrv().get();

    const datasourceRef = {
      type: defaultDs.meta.id,
      uid: defaultDs.uid,
    };

    if (defaultDs.getTagKeys) {
      const filterVariable = {
        datasource: datasourceRef,
        filters: [],
        name: 'Filter',
        type: 'adhoc',
      };

      variablesList = (variablesList || []).concat([filterVariable as VariableModel]);
    }

    if (defaultDs.getGroupByKeys) {
      const groupByVariable: VariableModel = {
        datasource: datasourceRef,
        name: 'Group by',
        type: 'groupby',
      };

      variablesList = (variablesList || []).concat([groupByVariable]);
    }
  }

  const data: DashboardDTO = {
    meta: {
      canStar: false,
      canShare: false,
      canDelete: false,
      isNew: true,
      folderUid: '',
    },
    dashboard: {
      ...defaultDashboard,
      uid: '',
      title: t('dashboard-scene.build-new-dashboard-save-model.data.title.new-dashboard', 'New dashboard'),
      panels: [],
      timezone: contextSrv.user?.timezone || defaultDashboard.timezone,
    },
  };

  if (variablesList) {
    data.dashboard.templating = {
      list: variablesList,
    };
  }

  if (urlFolderUid) {
    data.meta.folderUid = urlFolderUid;
  }

  return data;
}

export async function buildNewDashboardSaveModelV2(
  urlFolderUid?: string
): Promise<DashboardWithAccessInfo<DashboardV2Spec>> {
  let variablesList = defaultDashboardV2Spec().variables;

  if (config.featureToggles.newDashboardWithFiltersAndGroupBy) {
    // Add filter and group by variables if the datasource supports it
    const defaultDs = await getDatasourceSrv().get();

    const datasourceRef = {
      type: defaultDs.meta.id,
      uid: defaultDs.uid,
    };

    if (defaultDs.getTagKeys) {
      const filterVariable: AdhocVariableKind = {
        kind: 'AdhocVariable',
        group: datasourceRef.type,
        datasource: {
          name: datasourceRef.uid,
        },
        spec: { ...defaultAdhocVariableSpec(), name: 'Filter' },
      };

      variablesList = (variablesList || []).concat([filterVariable]);
    }

    if (defaultDs.getGroupByKeys) {
      const groupByVariable: GroupByVariableKind = {
        kind: 'GroupByVariable',
        group: datasourceRef.type,
        datasource: {
          name: datasourceRef.uid,
        },
        spec: {
          ...defaultGroupByVariableSpec(),
          name: 'Group by',
        },
      };

      variablesList = (variablesList || []).concat([groupByVariable]);
    }
  }

  const data: DashboardWithAccessInfo<DashboardV2Spec> = {
    apiVersion: dashboardAPIVersionResolver.getV2(),
    kind: 'DashboardWithAccessInfo',
    spec: {
      ...defaultDashboardV2Spec(),
      title: t('dashboard-scene.build-new-dashboard-save-model-v2.data.title.new-dashboard', 'New dashboard'),
      timeSettings: {
        ...defaultTimeSettingsSpec(),
        timezone: contextSrv.user?.timezone || defaultTimeSettingsSpec().timezone,
      },
    },
    access: {
      canStar: false,
      canShare: false,
      canDelete: false,
    },
    metadata: {
      name: '',
      resourceVersion: '0',
      creationTimestamp: new Date().toISOString(),
      annotations: {
        [AnnoKeyFolder]: '',
      },
    },
  };

  if (variablesList) {
    data.spec.variables = variablesList;
  }

  if (urlFolderUid && data.metadata.annotations) {
    data.metadata.annotations[AnnoKeyFolder] = urlFolderUid;
  }

  // Initialize default preferences to be same as the default layout
  if (config.featureToggles.dashboardDefaultLayoutSelector) {
    data.spec.preferences = {
      ...data.spec.preferences,
      layout: defaultGridLayoutKind(),
    };
  }

  return data;
}

/**
 * Builds a "new dashboard" save model (V2) pre-populated from an existing
 * dashboard. The source dashboard's identity is stripped so that saving creates
 * a brand-new dashboard rather than overwriting the source.
 */
export async function buildFromExistingDashboardSaveModelV2(
  sourceUid: string,
  urlFolderUid?: string
): Promise<DashboardWithAccessInfo<DashboardV2Spec>> {
  const api = await getDashboardAPI('v2');
  const source = await api.getDashboardDTO(sourceUid);

  // Deep clone so we never mutate anything held in the dashboard cache.
  const clone: DashboardWithAccessInfo<DashboardV2Spec> = structuredClone(source);

  // Strip identity so this is treated as a brand-new dashboard. In V2 an empty
  // metadata.name (the uid) is what marks the dashboard as new.
  clone.metadata.name = '';
  clone.metadata.resourceVersion = '0';
  clone.metadata.generation = undefined;
  clone.metadata.creationTimestamp = new Date().toISOString();

  // Drop server-managed save metadata; keep only the folder placement.
  const annotations = { ...clone.metadata.annotations };
  delete annotations[AnnoKeyCreatedBy];
  delete annotations[AnnoKeyUpdatedBy];
  delete annotations[AnnoKeyUpdatedTimestamp];
  delete annotations[AnnoKeyFolderTitle];
  delete annotations[AnnoKeyMessage];
  annotations[AnnoKeyFolder] = urlFolderUid ?? '';
  clone.metadata.annotations = annotations;

  // Match the empty-new dashboard access defaults.
  clone.access = {
    ...clone.access,
    canStar: false,
    canShare: false,
    canDelete: false,
  };

  clone.spec = {
    ...clone.spec,
    title: t('dashboard-scene.build-from-existing-dashboard-save-model-v2.title-copy', '{{title}} Copy', {
      title: clone.spec.title,
    }),
  };

  return clone;
}
