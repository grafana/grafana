import { t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { VariableModel, defaultDashboard } from '@grafana/schema';
import {
  AdhocVariableKind,
  defaultAdhocVariableSpec,
  defaultSpec as defaultDashboardV2Spec,
  defaultGroupByVariableSpec,
  defaultTimeSettingsSpec,
  GroupByVariableKind,
  Spec as DashboardV2Spec,
} from '@grafana/schema/dist/esm/schema/dashboard/v2';
import { AnnoKeyFolder } from 'app/features/apiserver/types';
import { DashboardWithAccessInfo } from 'app/features/dashboard/api/types';
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';
import { DashboardDTO } from 'app/types/dashboard';

import { contextSrv } from '../../../core/services/context_srv';

export async function buildNewDashboardSaveModel(urlFolderUid?: string): Promise<DashboardDTO> {
  let variablesList = defaultDashboard.templating?.list;

  if (config.featureToggles.newDashboardWithFiltersAndGroupBy) {
    // Add filter and group by variables if the datasource supports it
    const defaultDs = await getDatasourceSrv().get();

    if (defaultDs.getTagKeys) {
      const datasourceRef = {
        type: defaultDs.meta.id,
        uid: defaultDs.uid,
      };

      const filterVariable = {
        datasource: datasourceRef,
        filters: [],
        name: 'Filter',
        type: 'adhoc',
      };

      const groupByVariable: VariableModel = {
        datasource: datasourceRef,
        name: 'Group by',
        type: 'groupby',
      };

      variablesList = (variablesList || []).concat([filterVariable as VariableModel, groupByVariable]);
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

    if (defaultDs.getTagKeys) {
      const datasourceRef = {
        type: defaultDs.meta.id,
        uid: defaultDs.uid,
      };

      const filterVariable: AdhocVariableKind = {
        kind: 'AdhocVariable',
        group: datasourceRef.type,
        datasource: {
          name: datasourceRef.uid,
        },
        spec: { ...defaultAdhocVariableSpec(), name: 'Filter' },
      };

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

      variablesList = (variablesList || []).concat([filterVariable, groupByVariable]);
    }
  }

  const data: DashboardWithAccessInfo<DashboardV2Spec> = {
    apiVersion: 'v2beta1',
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
      creationTimestamp: '0',
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

  return data;
}
