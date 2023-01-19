import {
  AlertmanagerChoice,
  ExternalAlertmanagerConfig,
  ExternalAlertmanagers,
  ExternalAlertmanagersResponse,
} from '../../../../plugins/datasource/alertmanager/types';

import { alertingApi } from './alertingApi';

export interface AlertmanagersChoiceResponse {
  alertmanagersChoice: AlertmanagerChoice;
}

export const alertmanagerApi = alertingApi.injectEndpoints({
  endpoints: (build) => ({
    getAlertmanagerChoice: build.query<AlertmanagerChoice, void>({
      query: () => ({ url: '/api/v1/ngalert' }),
      providesTags: ['AlertmanagerChoice'],
      transformResponse: (response: AlertmanagersChoiceResponse) => response.alertmanagersChoice,
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
