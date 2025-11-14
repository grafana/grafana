import { getBackendSrv } from '@grafana/runtime';
import { DashboardJson } from 'app/features/manage-dashboards/types';
import { PluginDashboard } from 'app/types/plugins';

import { GnetDashboardsResponse, Link } from '../types';

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

  // Grafana.com API returns format: { page: number, pages: number, items: GnetDashboard[] }
  // We normalize it to use "dashboards" instead of "items" for consistency
  if (result) {
    return {
      page: result.page || params.page,
      pages: result.pages || 1,
      items: result.items,
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
