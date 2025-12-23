import { getBackendSrv } from '@grafana/runtime';
import { DashboardJson } from 'app/features/manage-dashboards/types';
import { PluginDashboard } from 'app/types/plugins';

import { GnetDashboard, GnetDashboardsResponse, Link } from '../types';

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
 * Minimum number of downloads required for a community dashboard to be shown as a suggestion.
 *
 * Rationale:
 * - Dashboards with higher download counts have been vetted by a larger community
 * - This acts as a heuristic for quality and trustworthiness
 * - Reduces risk of malicious or poorly-maintained dashboards
 *
 * Trade-offs:
 * - May filter out legitimate but less popular dashboards
 * - Newer dashboards with good content but low download counts won't be shown
 * - The threshold of 10,000 is somewhat arbitrary and may need tuning based on ecosystem growth
 */
const MIN_DOWNLOADS_FILTER = 10000;

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
    const dashboards = filterNonSafeDashboards(result.items);

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
    return Array.isArray(dashboards) ? dashboards : [];
  } catch (error) {
    console.error('Error loading provisioned dashboards', error);
    return [];
  }
}

// We only show dashboards with at least MIN_DOWNLOADS_FILTER downloads
// They are already ordered by downloads amount
const filterNonSafeDashboards = (dashboards: GnetDashboard[]): GnetDashboard[] => {
  return dashboards.filter((item: GnetDashboard) => {
    const hasUnsafePanelTypes = item.panelTypeSlugs?.some((slug: string) => UNSAFE_PANEL_TYPE_SLUGS.includes(slug));
    const hasLowDownloads = typeof item.downloads === 'number' && item.downloads < MIN_DOWNLOADS_FILTER;

    if (hasUnsafePanelTypes || hasLowDownloads) {
      console.warn(
        `Community dashboard ${item.id} ${item.name} filtered out due to low downloads ${item.downloads} or panel types ${item.panelTypeSlugs?.join(', ')} that can embed JavaScript`
      );
      return false;
    }
    return true;
  });
};
