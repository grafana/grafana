/** @deprecated To be deleted - use alertingApiServer API instead */

import { ContactPointsState } from 'app/types/alerting';

import { CONTACT_POINTS_STATE_INTERVAL_MS } from '../utils/constants';

import { alertingApi } from './alertingApi';
import { fetchContactPointsState } from './grafana';
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { notificationsAlertingV0alpha1RTK } from '@grafana/hackathon-13-registrar-private/rtk-query';

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

export const registrarAlertingNotificationsApi = createApi({
  reducerPath: 'alertingNotificationsBaseApi',
  baseQuery: fetchBaseQuery(),
  endpoints: () => ({}),
});

export const alertingNotificationsApiFromRegistrar = registrarAlertingNotificationsApi.injectEndpoints({
  endpoints: (build) => ({
    ...notificationsAlertingV0alpha1RTK.notificationsAlertingV0alpha1Endpoints(build),
  }),
});
