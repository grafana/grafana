import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

export type ResourceType = 'dashboard' | 'folder' | 'alert';

export interface PopularResource {
  uid: string;
  title: string;
  url: string;
  resourceType: ResourceType;
  folderUid?: string;
  folderTitle?: string;
  visitCount: number;
  lastVisited: string;
  firstVisited: string;
}

export interface PopularResourcesResponse {
  resources: PopularResource[];
  totalCount: number;
}

export interface GetPopularResourcesParams {
  type?: ResourceType;
  limit?: number;
  period?: '7d' | '30d' | '90d' | 'all';
}

export interface GetRecentResourcesParams {
  types?: ResourceType[];
  limit?: number;
  period?: '7d' | '30d' | '90d' | 'all';
}

export const popularResourcesApi = createApi({
  reducerPath: 'popularResourcesApi',
  baseQuery: fetchBaseQuery({
    baseUrl: '/api/',
  }),
  tagTypes: ['PopularResources', 'RecentResources'],
  endpoints: (builder) => ({
    getPopularResources: builder.query<PopularResourcesResponse, GetPopularResourcesParams>({
      query: ({ type, limit = 10, period = '30d' } = {}) => {
        const params = new URLSearchParams();
        if (type) {params.set('type', type);}
        params.set('limit', limit.toString());
        params.set('period', period);
        
        return `resources/popular?${params.toString()}`;
      },
      providesTags: ['PopularResources'],
    }),
    
    getRecentResources: builder.query<PopularResourcesResponse, GetRecentResourcesParams>({
      query: ({ types = [], limit = 10, period = '30d' } = {}) => {
        const params = new URLSearchParams();
        // Add types as array parameters (types[]=dashboard&types[]=folder)
        types.forEach(type => params.append('types[]', type));
        params.set('limit', limit.toString());
        params.set('period', period);
        
        return `resources/recent?${params.toString()}`;
      },
      providesTags: ['RecentResources'],
    }),
    
    recordResourceVisit: builder.mutation<{ message: string }, { uid: string; type: ResourceType }>({
      query: ({ uid, type }) => ({
        url: `resources/${type}/${uid}/visit`,
        method: 'POST',
      }),
      invalidatesTags: ['PopularResources', 'RecentResources'],
    }),
  }),
});

export const { 
  useGetPopularResourcesQuery,
  useGetRecentResourcesQuery,
  useRecordResourceVisitMutation,
} = popularResourcesApi;

// Dynamic hook that takes resource type as parameter
export const useGetPopularResourcesByType = (resourceType: ResourceType, params?: Omit<GetPopularResourcesParams, 'type'>) =>
  useGetPopularResourcesQuery({ ...params, type: resourceType });

// Convenience hooks for specific resource types
export const useGetPopularDashboards = (params?: Omit<GetPopularResourcesParams, 'type'>) =>
  useGetPopularResourcesQuery({ ...params, type: 'dashboard' });

export const useGetPopularFolders = (params?: Omit<GetPopularResourcesParams, 'type'>) =>
  useGetPopularResourcesQuery({ ...params, type: 'folder' });

export const useGetPopularAlerts = (params?: Omit<GetPopularResourcesParams, 'type'>) =>
  useGetPopularResourcesQuery({ ...params, type: 'alert' });

// Dynamic hook with conditional fetching
export const useGetPopularResourcesConditional = (
  resourceType: ResourceType | null, 
  params?: Omit<GetPopularResourcesParams, 'type'>
) =>
  useGetPopularResourcesQuery(
    { ...params, type: resourceType! }, 
    { skip: !resourceType } // Skip the query if resourceType is null
  );

// Recent resources hooks with support for multiple types
export const useGetRecentResources = (params?: GetRecentResourcesParams) =>
  useGetRecentResourcesQuery(params || {});

// Convenience hook for recent dashboards and folders together
export const useGetRecentDashboardsAndFolders = (params?: Omit<GetRecentResourcesParams, 'types'>) =>
  useGetRecentResourcesQuery({ ...params, types: ['dashboard', 'folder'] });

// Convenience hook for recent dashboards only
export const useGetRecentDashboards = (params?: Omit<GetRecentResourcesParams, 'types'>) =>
  useGetRecentResourcesQuery({ ...params, types: ['dashboard'] });

// Convenience hook for recent folders only
export const useGetRecentFolders = (params?: Omit<GetRecentResourcesParams, 'types'>) =>
  useGetRecentResourcesQuery({ ...params, types: ['folder'] });

// Convenience hook for recent alerts only
export const useGetRecentAlerts = (params?: Omit<GetRecentResourcesParams, 'types'>) =>
  useGetRecentResourcesQuery({ ...params, types: ['alert'] });
