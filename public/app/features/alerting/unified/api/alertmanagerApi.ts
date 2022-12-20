import {
  AlertmanagerChoice,
  AlertManagerCortexConfig,
  ExternalAlertmanagerConfig,
  ExternalAlertmanagers,
  ExternalAlertmanagersResponse,
} from '../../../../plugins/datasource/alertmanager/types';
import { getDatasourceAPIUid, GRAFANA_RULES_SOURCE_NAME } from '../utils/datasource';

import { alertingApi } from './alertingApi';

const LIMIT_TO_SUCCESSFULLY_APPLIED_AMS = 10;

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

    getValidAlertManagersConfig: build.query<AlertManagerCortexConfig[], void>({
      //this is only available for the "grafana" alert manager
      query: () => ({
        url: `/api/alertmanager/${getDatasourceAPIUid(
          GRAFANA_RULES_SOURCE_NAME
        )}/config/history?limit=${LIMIT_TO_SUCCESSFULLY_APPLIED_AMS}`,
      }),
    }),
  }),
});
