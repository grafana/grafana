import {
  AlertmanagerChoice,
  ExternalAlertmanagerConfig,
  ExternalAlertmanagers,
  ExternalAlertmanagersResponse,
} from '../../../../plugins/datasource/alertmanager/types';

import { alertingApi } from './alertingApi';

export interface AlertmanagersChoiceResponse {
  alertmanagersChoice: AlertmanagerChoice;
  numExternalAlertmanagers: number;
}

export const alertmanagerApi = alertingApi.injectEndpoints({
  endpoints: (build) => ({
    getAlertmanagerChoiceStatus: build.query<AlertmanagersChoiceResponse, void>({
      query: () => ({ url: '/api/v1/ngalert' }),
      providesTags: ['AlertmanagerChoice'],
    }),

    getExternalAlertmanagerConfig: build.query<ExternalAlertmanagerConfig, void>({
      query: () => ({ url: '/api/v1/ngalert/admin_config' }),
      providesTags: ['AlertmanagerChoice'],
    }),

    getExternalAlertmanagers: build.query<ExternalAlertmanagers, void>({
      query: () => ({ url: '/api/v1/ngalert/alertmanagers' }),
      transformResponse: (response: ExternalAlertmanagersResponse) => response.data,
    }),

    saveExternalAlertmanagersConfig: build.mutation<{ message: string }, ExternalAlertmanagerConfig>({
      query: (config) => ({ url: '/api/v1/ngalert/admin_config', method: 'POST', data: config }),
      invalidatesTags: ['AlertmanagerChoice'],
    }),
  }),
});
