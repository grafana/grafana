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
      providesTags: ['AlertSilences'],
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
      }),
      providesTags: ['AlertSilences'],
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
      invalidatesTags: ['AlertSilences'],
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
      invalidatesTags: ['AlertSilences'],
    }),
  }),
});
