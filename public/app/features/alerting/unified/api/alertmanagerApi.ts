import {
  AlertmanagerAlert,
  AlertmanagerChoice,
  AlertManagerCortexConfig,
  ExternalAlertmanagerConfig,
  ExternalAlertmanagers,
  ExternalAlertmanagersResponse,
  Matcher,
} from '../../../../plugins/datasource/alertmanager/types';
import { matcherToOperator } from '../utils/alertmanager';
import { getDatasourceAPIUid, GRAFANA_RULES_SOURCE_NAME } from '../utils/datasource';

import { alertingApi } from './alertingApi';

const LIMIT_TO_SUCCESSFULLY_APPLIED_AMS = 10;

export interface AlertmanagersChoiceResponse {
  alertmanagersChoice: AlertmanagerChoice;
  numExternalAlertmanagers: number;
}

interface AlertmanagerAlertsFilter {
  active?: boolean;
  silenced?: boolean;
  inhibited?: boolean;
  unprocessed?: boolean;
  matchers?: Matcher[];
}

// Based on https://github.com/prometheus/alertmanager/blob/main/api/v2/openapi.yaml
export const alertmanagerApi = alertingApi.injectEndpoints({
  endpoints: (build) => ({
    getAlertmanagerAlerts: build.query<
      AlertmanagerAlert[],
      { amSourceName: string; filter?: AlertmanagerAlertsFilter }
    >({
      query: ({ amSourceName, filter }) => {
        // TODO Add support for active, silenced, inhibited, unprocessed filters
        const filterMatchers = filter?.matchers
          ?.filter((matcher) => matcher.name && matcher.value)
          .map((matcher) => `${matcher.name}${matcherToOperator(matcher)}${matcher.value}`);

        return {
          url: `/api/alertmanager/${getDatasourceAPIUid(amSourceName)}/api/v2/alerts`,
          params: { filter: filterMatchers },
        };
      },
    }),

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

    resetAlertManagerConfigToOldVersion: build.mutation<{ message: string }, { id: number }>({
      //this is only available for the "grafana" alert manager
      query: (config) => ({
        url: `/api/alertmanager/${getDatasourceAPIUid(GRAFANA_RULES_SOURCE_NAME)}/config/history/${
          config.id
        }/_activate`,
        method: 'POST',
      }),
    }),
  }),
});
