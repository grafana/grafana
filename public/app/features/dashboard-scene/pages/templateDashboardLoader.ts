import { getBackendSrv, getDataSourceInstanceSettings } from '@grafana/runtime';
import { contextSrv } from 'app/core/services/context_srv';
import { interpolateV1Dashboard } from 'app/features/manage-dashboards/import/utils/inputs';
import { type DashboardDataDTO, type DashboardDTO } from 'app/types/dashboard';

/**
 * The dashboard a template page opens from its URL's parameters (`params`): a Grafana template or a
 * community dashboard from grafana.com, or a plugin's dashboard, each interpolated with the data
 * sources the parameters name, as a new dashboard. Custom templates (`dashboardTemplateUid`) are not
 * among them.
 */
export async function loadLibraryDashboard(params: URLSearchParams): Promise<DashboardDTO> {
  const datasource = params.get('datasource');
  const gnetId = params.get('gnetId');
  const pluginId = params.get('pluginId');
  const path = params.get('path');

  // Check if this is a Grafana dashboard template
  if (gnetId && datasource && pluginId) {
    return loadGrafanaDashboardTemplate(gnetId, datasource, pluginId);
  }

  // Check if this is a community dashboard (has gnetId) or plugin dashboard
  if (gnetId) {
    return loadCommunityTemplateDashboard(gnetId, params.get('mappings'));
  }

  // Original plugin dashboard flow
  if (!datasource || !pluginId || !path) {
    throw new Error('Missing required parameters for template dashboard');
  }

  const ds = await getDataSourceInstanceSettings(datasource);
  if (!ds) {
    throw new Error(`Datasource "${datasource}" not found. Please check your datasource configuration.`);
  }

  const data = {
    pluginId,
    path,
    overwrite: true,
    inputs: [
      {
        name: '*',
        type: 'datasource',
        pluginId,
        value: datasource,
      },
    ],
  };

  const interpolatedDashboard = await getBackendSrv().post('/api/dashboards/interpolate', data);
  return buildDashboardDTOFromInterpolated(interpolatedDashboard);
}

function buildDashboardDTOFromInterpolated(interpolatedDashboard: DashboardDataDTO): DashboardDTO {
  return {
    dashboard: {
      ...interpolatedDashboard,
      uid: '',
      version: 0,
      id: null,
    },
    meta: {
      canSave: contextSrv.hasEditPermissionInFolders,
      canEdit: contextSrv.hasEditPermissionInFolders,
      canStar: false,
      canShare: false,
      canDelete: false,
      isNew: true,
      folderUid: '',
    },
  };
}

async function loadGrafanaDashboardTemplate(
  gnetId: string,
  datasource: string | null,
  pluginId: string | null
): Promise<DashboardDTO> {
  // Fetch the community dashboard from grafana.com
  const gnetDashboard = await getBackendSrv().get(`/api/gnet/dashboards/${gnetId}`);

  // The dashboard JSON is in the 'json' property
  const dashboardJson = gnetDashboard.json;

  // Interpolate in the frontend — no backend round-trip needed
  const interpolatedDashboard = await interpolateV1Dashboard(dashboardJson, [
    {
      name: '*',
      type: 'datasource',
      pluginId: pluginId ?? undefined,
      value: datasource ?? '',
    },
  ]);
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  return buildDashboardDTOFromInterpolated(interpolatedDashboard as DashboardDataDTO);
}

async function loadCommunityTemplateDashboard(
  gnetId: number | string,
  mappingsJson: string | null
): Promise<DashboardDTO> {
  if (!mappingsJson) {
    throw new Error('Missing mappings parameter for community dashboard');
  }

  let mappings;
  try {
    mappings = JSON.parse(mappingsJson);
  } catch (err) {
    throw new Error('Invalid mappings parameter: ' + err);
  }

  // Fetch the community dashboard from grafana.com
  const gnetDashboard = await getBackendSrv().get(`/api/gnet/dashboards/${gnetId}`);

  // The dashboard JSON is in the 'json' property
  const dashboardJson = gnetDashboard.json;

  // Interpolate in the frontend — no backend round-trip needed
  const interpolatedDashboard = await interpolateV1Dashboard(dashboardJson, mappings);
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  return buildDashboardDTOFromInterpolated(interpolatedDashboard as DashboardDataDTO);
}
