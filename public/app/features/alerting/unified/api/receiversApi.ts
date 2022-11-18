import { ContactPointsState } from 'app/types';

import { CONTACT_POINTS_STATE_INTERVAL_MS } from '../utils/constants';

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

export const useGetContactPointsState = (alertManagerSourceName: string) => {
  const contactPointsStateEmpty: ContactPointsState = { receivers: {}, errorCount: 0 };
  const { currentData: contactPointsState } = receiversApi.useContactPointsStateQuery(
    { amSourceName: alertManagerSourceName ?? '' },
    {
      skip: !alertManagerSourceName,
      pollingInterval: CONTACT_POINTS_STATE_INTERVAL_MS,
    }
  );
  return contactPointsState ?? contactPointsStateEmpty;
};
