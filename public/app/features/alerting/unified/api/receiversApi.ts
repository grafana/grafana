import { ContactPointsState } from 'app/types';

import { alertingApi } from './alertingApi';
import { fetchContactPointsState } from './grafana';

export const receiversApi = alertingApi.injectEndpoints({
  endpoints: (build) => ({
    contactPointsState: build.query<ContactPointsState, { amSourceName: string }>({
      queryFn: async ({ amSourceName }) => {
        try {
          const contactPointsState = await fetchContactPointsState(amSourceName);
          return { data: contactPointsState };
        } catch (error) {
          return { error: error };
        }
      },
    }),
  }),
});
