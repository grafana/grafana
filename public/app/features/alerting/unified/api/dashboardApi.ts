import { DashboardDTO } from '../../../../types';
import { DashboardSearchItem } from '../../../search/types';

import { alertingApi } from './alertingApi';

export const dashboardApi = alertingApi.injectEndpoints({
  endpoints: (build) => ({
    search: build.query<DashboardSearchItem[], { query?: string }>({
      query: ({ query }) => {
        const params = new URLSearchParams({ type: 'dash-db', limit: '1000', page: '1', sort: 'name_sort' });
        if (query) {
          params.set('query', query);
        }

        return { url: `/api/search?${params.toString()}` };
      },
    }),
    dashboard: build.query<DashboardDTO, { uid: string }>({
      query: ({ uid }) => ({ url: `/api/dashboards/uid/${uid}` }),
    }),
  }),
});
