import { useAsync } from 'react-use';

import { getBackendSrv } from '@grafana/runtime';

import { SortBy, GnetAPIResponse, SORT_TO_DIRECTION } from './types';

import { DashboardQueryResult } from 'app/features/search/service';

interface UseCommunityTemplatesOptions {
  sortBy?: SortBy;
  page?: number;
  filter?: string;
  pageSize?: number;
  filterByIds?: string[];
}

export function useCommunityTemplates({
  sortBy = 'downloads',
  page = 1,
  filter = '',
  pageSize = 30,
  filterByIds = [],
}: UseCommunityTemplatesOptions) {
  const {
    value: response,
    loading,
    error,
  } = useAsync(async () => {
    return await getBackendSrv().get<GnetAPIResponse>(
      `/api/gnet/dashboards?orderBy=${sortBy}&direction=${SORT_TO_DIRECTION[sortBy]}&page=${page}&pageSize=${pageSize}&includeLogo=1&includeScreenshots=true&filter=${filter}${filterByIds.map((id) => `&idIn=${id}`)}`
    );
  }, [sortBy, page, filter]);

  return {
    dashboards: response ? response.items : null,
    loading,
    error,
    pages: response ? response.pages : 0,
    total: response ? response.total : 0,
    page: response ? response.page : 0,
  };
}

interface UseOrgTemplatesOptions {}

interface UseOrgTemplatesResponse {
  dashboards: DashboardQueryResult;
  loading: boolean;
  error?: Error;
}

export function useOrgTemplates({}: UseOrgTemplatesOptions): UseOrgTemplatesResponse {
  const {
    value: response,
    loading,
    error,
  } = useAsync(async () => {
    return await getBackendSrv().get<DashboardQueryResult>(
      `/api/search?permission=View&sort=alpha-asc&tag=template&type=dash-db`
    );
  }, []);

  return {
    dashboards: response,
    loading,
    error,
  };
}

interface UseCommunityTemplateOptions {
  dashboardId: number;
}

export function useCommunityTemplate({ dashboardId }: UseCommunityTemplateOptions) {
  const {
    value: response,
    loading,
    error,
  } = useAsync(async () => {
    return await getBackendSrv().get<GnetAPIResponse>(`/api/gnet/dashboards/${dashboardId}`);
  }, [dashboardId]);

  return {
    dashboards: response || null,
    loading,
    error,
  };
}
