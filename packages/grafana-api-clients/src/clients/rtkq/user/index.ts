import { generatedAPI as rawAPI } from './endpoints.gen';

export const generatedAPI = rawAPI
  .enhanceEndpoints({
    addTagTypes: ['dashboardStars'],
    endpoints: {
      starDashboardByUid: {
        invalidatesTags: ['dashboardStars'],
      },
      unstarDashboardByUid: {
        invalidatesTags: ['dashboardStars'],
      },
    },
  })
  .injectEndpoints({
    endpoints: (build) => ({
      getStars: build.query<string[], void>({
        query: () => ({ url: '/user/stars' }),
        providesTags: ['dashboardStars'],
      }),
    }),
  });

export const { useGetStarsQuery } = generatedAPI;
export * from './endpoints.gen';
