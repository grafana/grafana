import { Silence, SilenceCreatePayload } from 'app/plugins/datasource/alertmanager/types';

import { alertingApi } from './alertingApi';

export const alertSilencesApi = alertingApi.injectEndpoints({
  endpoints: (build) => ({
    getSilences: build.query<
      Silence[],
      {
        datasourceUid: string;
      }
    >({
      query: ({ datasourceUid }) => ({
        url: `/api/alertmanager/${datasourceUid}/api/v2/silences`,
      }),
      providesTags: (result) =>
        result ? result.map(({ id }) => ({ type: 'AlertmanagerSilences', id })) : ['AlertmanagerSilences'],
    }),

    getSilence: build.query<
      Silence,
      {
        datasourceUid: string;
        id: string;
      }
    >({
      query: ({ datasourceUid, id }) => ({
        url: `/api/alertmanager/${datasourceUid}/api/v2/silence/${id}`,
        showErrorAlert: false,
      }),
      providesTags: (result, error, { id }) =>
        result ? [{ type: 'AlertmanagerSilences', id }] : ['AlertmanagerSilences'],
    }),

    createSilence: build.mutation<
      {
        silenceId: string;
      },
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
