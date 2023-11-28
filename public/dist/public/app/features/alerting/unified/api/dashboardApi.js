import { alertingApi } from './alertingApi';
export const dashboardApi = alertingApi.injectEndpoints({
    endpoints: (build) => ({
        search: build.query({
            query: ({ query }) => {
                const params = new URLSearchParams({ type: 'dash-db', limit: '1000', page: '1', sort: 'name_sort' });
                if (query) {
                    params.set('query', query);
                }
                return { url: `/api/search?${params.toString()}` };
            },
        }),
        dashboard: build.query({
            query: ({ uid }) => ({ url: `/api/dashboards/uid/${uid}` }),
        }),
    }),
});
//# sourceMappingURL=dashboardApi.js.map