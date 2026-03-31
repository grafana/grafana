import { getBackendSrv, logInfo, logWarning } from '@grafana/runtime';
import { type DashboardJson } from 'app/features/manage-dashboards/types';
import { type PluginDashboard } from 'app/types/plugins';

import { type GnetDashboard, type GnetDashboardsResponse, type Link } from '../types';

/**
 * Panel types that are known to allow JavaScript code execution.
 * These panels are filtered out due to security concerns.
 */
const UNSAFE_PANEL_TYPE_SLUGS = [
  'aceiot-svg-panel',
  'ae3e-plotly-panel',
  'gapit-htmlgraphics-panel',
  'marcusolsson-dynamictext-panel',
  'volkovlabs-echarts-panel',
  'volkovlabs-form-panel',
];

/**
 * Parameters for fetching community dashboards from Grafana.com
 */
export interface FetchCommunityDashboardsParams {
  orderBy: string;
  direction: 'asc' | 'desc';
  page: number;
  pageSize: number;
  includeLogo: boolean;
  includeScreenshots: boolean;
  dataSourceSlugIn?: string;
  filter?: string;
}

/**
 * Dependency item from Grafana.com dashboard API
 */
export interface GnetDashboardDependency {
  pluginSlug: string;
  pluginTypeCode: 'app' | 'panel' | 'datasource' | 'grafana';
  pluginName?: string;
  pluginVersion?: string;
  [key: string]: unknown;
}

/**
 * Response from the Gnet API when fetching a single dashboard
 */
export interface GnetDashboardResponse {
  json: DashboardJson;
  dependencies?: {
    items?: GnetDashboardDependency[];
    direction?: 'asc' | 'desc';
    orderBy?: string;
    links?: Link[];
  };
  [key: string]: unknown;
}

/**
 * Fetch community dashboards from Grafana.com
 */
export async function fetchCommunityDashboards(
  params: FetchCommunityDashboardsParams
): Promise<GnetDashboardsResponse> {
  const searchParams = new URLSearchParams({
    orderBy: params.orderBy,
    direction: params.direction,
    page: params.page.toString(),
    pageSize: params.pageSize.toString(),
    includeLogo: params.includeLogo ? '1' : '0',
    includeScreenshots: params.includeScreenshots ? 'true' : 'false',
    includePanelTypeSlugs: 'true',
  });

  if (params.dataSourceSlugIn) {
    searchParams.append('dataSourceSlugIn', params.dataSourceSlugIn);
  }
  if (params.filter) {
    searchParams.append('filter', params.filter);
  }

  const result = await getBackendSrv().get(`/api/gnet/dashboards?${searchParams}`, undefined, undefined, {
    showErrorAlert: false,
  });

  if (result && Array.isArray(result.items)) {
    logInfo('Fetched community dashboards', {
      searchParams: searchParams.toString(),
      dataSourceType: params.dataSourceSlugIn ?? '',
      total: result.items.length,
      page: result.page,
      pages: result.pages,
    });

    const dashboards = filterNonSafeDashboards(result.items, params.dataSourceSlugIn);

    return {
      page: result.page || params.page,
      pages: result.pages || 1,
      items: dashboards,
    };
  }

  // Fallback for unexpected response format
  console.warn('Unexpected API response format from Grafana.com:', result);
  return {
    page: params.page,
    pages: 1,
    items: [],
  };
}

/**
 * Fetch a single community dashboard's full JSON from Grafana.com
 */
export async function fetchCommunityDashboard(gnetId: number): Promise<GnetDashboardResponse> {
  return getBackendSrv().get(`/api/gnet/dashboards/${gnetId}`);
}

/**
 * Fetch provisioned dashboards for a datasource type
 */
export async function fetchProvisionedDashboards(datasourceType: string): Promise<PluginDashboard[]> {
  try {
    const dashboards = await getBackendSrv().get(`api/plugins/${datasourceType}/dashboards`, undefined, undefined, {
      showErrorAlert: false,
    });
    return Array.isArray(dashboards) ? dashboards.filter((dashboard) => !dashboard.removed) : [];
  } catch (error) {
    console.error('Error loading provisioned dashboards', error);
    return [];
  }
}

// We filter out dashboards with unsafe panel types that can execute JavaScript
// They are previously ordered by downloads amount
const filterNonSafeDashboards = (dashboards: GnetDashboard[], dataSourceType?: string): GnetDashboard[] => {
  let unsafeDashboardsCount = 0;

  const filteredDashboards = dashboards.filter((item: GnetDashboard) => {
    const unsafePanelTypes =
      item.panelTypeSlugs?.filter((slug: string) => UNSAFE_PANEL_TYPE_SLUGS.includes(slug)) ?? [];

    if (unsafePanelTypes.length > 0) {
      unsafeDashboardsCount++;

      console.warn(
        `Community dashboard ${item.id} ${item.name} filtered out due to panel types ${item.panelTypeSlugs?.join(', ')} that can embed JavaScript`
      );

      logWarning('Community dashboard filtered out due to unsafe panel types', {
        dashboardId: item.id.toString(),
        dashboardName: item.name,
        panelTypes: item.panelTypeSlugs?.join(', ') ?? '',
        unsafePanelTypes: unsafePanelTypes.join(', '),
      });
      return false;
    }
    return true;
  });

  if (filteredDashboards.length === 0) {
    logWarning('No community dashboards found after safe filtering', {
      dataSourceType: dataSourceType ?? '',
      unsafeDashboardsCount: unsafeDashboardsCount.toString(),
    });
  }

  return filteredDashboards;
};
