import { config } from '@grafana/runtime';
import { VariableModel, defaultDashboard } from '@grafana/schema';
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';
import { DashboardDTO } from 'app/types';

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

      const fitlerVariable: VariableModel = {
        datasource: datasourceRef,
        name: 'Filter',
        type: 'adhoc',
      };

      const groupByVariable: VariableModel = {
        datasource: datasourceRef,
        name: 'Group by',
        type: 'groupby',
      };

      variablesList = (variablesList || []).concat([fitlerVariable, groupByVariable]);
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
      title: 'New dashboard',
      panels: [],
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
