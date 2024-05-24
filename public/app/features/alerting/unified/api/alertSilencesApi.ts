import { AppEvents } from '@grafana/data';
import appEvents from 'app/core/app_events';
import { Silence, SilenceCreatePayload } from 'app/plugins/datasource/alertmanager/types';

import { alertingApi } from './alertingApi';

export type SilenceCreatedResponse = {
  silenceId: string;
};

export const alertSilencesApi = alertingApi.injectEndpoints({
  endpoints: (build) => ({
    getSilences: build.query<
      Silence[],
      {
        datasourceUid: string;
        withMetadata?: boolean;
        accessControl?: boolean;
      }
    >({
      query: ({ datasourceUid, withMetadata, accessControl }) => ({
        url: `/api/alertmanager/${datasourceUid}/api/v2/silences`,
        params: { withMetadata, accessControl },
      }),
      providesTags: (result) =>
        result ? result.map(({ id }) => ({ type: 'AlertmanagerSilences', id })) : ['AlertmanagerSilences'],
    }),

    getSilence: build.query<
      Silence,
      {
        datasourceUid: string;
        id: string;
        withMetadata?: boolean;
        accessControl?: boolean;
      }
    >({
      query: ({ datasourceUid, id, withMetadata, accessControl }) => ({
        url: `/api/alertmanager/${datasourceUid}/api/v2/silence/${id}`,
        showErrorAlert: false,
        params: { withMetadata, accessControl },
      }),
      providesTags: (result, error, { id }) =>
        result ? [{ type: 'AlertmanagerSilences', id }] : ['AlertmanagerSilences'],
    }),

    createSilence: build.mutation<
      SilenceCreatedResponse,
      {
        datasourceUid: string;
        payload: SilenceCreatePayload;
      }
    >({
      query: ({ datasourceUid, payload }) => ({
        url: `/api/alertmanager/${datasourceUid}/api/v2/silences`,
        method: 'POST',
        data: payload,
      }),
      invalidatesTags: ['AlertmanagerSilences', 'AlertmanagerAlerts'],
      onQueryStarted: async (arg, { queryFulfilled }) => {
        try {
          await queryFulfilled;
          appEvents.emit(AppEvents.alertSuccess, ['Silence created']);
        } catch (error) {
          appEvents.emit(AppEvents.alertError, ['Could not create silence']);
        }
      },
    }),

    expireSilence: build.mutation<
      {
        message: string;
      },
      {
        datasourceUid: string;
        silenceId: string;
      }
    >({
      query: ({ datasourceUid, silenceId }) => ({
        url: `/api/alertmanager/${datasourceUid}/api/v2/silence/${silenceId}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['AlertmanagerSilences'],
    }),
  }),
});
