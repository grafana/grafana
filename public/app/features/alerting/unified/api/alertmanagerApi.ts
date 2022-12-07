import {
  AlertmanagerChoice,
  AlertManagerCortexConfig,
  ExternalAlertmanagerConfig,
  ExternalAlertmanagers,
  ExternalAlertmanagersResponse,
} from '../../../../plugins/datasource/alertmanager/types';
import { getDatasourceAPIUid, GRAFANA_RULES_SOURCE_NAME } from '../utils/datasource';

import { alertingApi } from './alertingApi';

const limitToSuccessfullyAppliedAMs = 10;

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

    getValidAlertManagersConfig: build.query<AlertManagerCortexConfig[], void>({
      //this is only available for the "grafana" alert manager
      query: () => ({
        url: `/api/alertmanager/${getDatasourceAPIUid(
          GRAFANA_RULES_SOURCE_NAME
        )}/config/api/v1/alerts/successfully-applied?limit=${limitToSuccessfullyAppliedAMs}`,
      }),
    }),
  }),
});
