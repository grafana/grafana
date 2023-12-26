import { isEmpty } from 'lodash';

import { dispatch } from 'app/store/store';
import { ReceiversStateDTO } from 'app/types/alerting';

import {
  AlertmanagerAlert,
  AlertmanagerChoice,
  AlertManagerCortexConfig,
  AlertmanagerGroup,
  ExternalAlertmanagerConfig,
  ExternalAlertmanagers,
  ExternalAlertmanagersResponse,
  Matcher,
} from '../../../../plugins/datasource/alertmanager/types';
import { NotifierDTO } from '../../../../types';
import { withPerformanceLogging } from '../Analytics';
import { matcherToOperator } from '../utils/alertmanager';
import {
  getDatasourceAPIUid,
  GRAFANA_RULES_SOURCE_NAME,
  isVanillaPrometheusAlertManagerDataSource,
} from '../utils/datasource';
import { retryWhile, wrapWithQuotes } from '../utils/misc';
import { messageFromError, withSerializedError } from '../utils/redux';

import { alertingApi } from './alertingApi';
import { fetchAlertManagerConfig, fetchStatus } from './alertmanager';
import { featureDiscoveryApi } from './featureDiscoveryApi';

const LIMIT_TO_SUCCESSFULLY_APPLIED_AMS = 10;
const FETCH_CONFIG_RETRY_TIMEOUT = 30 * 1000;

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
          .map((matcher) => `${matcher.name}${matcherToOperator(matcher)}${wrapWithQuotes(matcher.value)}`);

        const { silenced, inhibited, unprocessed, active } = filter || {};

        const stateParams = Object.fromEntries(
          Object.entries({ silenced, active, inhibited, unprocessed }).filter(([_, value]) => value !== undefined)
        );

        const params: Record<string, unknown> | undefined = { filter: filterMatchers };

        if (stateParams) {
          Object.keys(stateParams).forEach((key: string) => {
            params[key] = stateParams[key];
          });
        }

        return {
          url: `/api/alertmanager/${getDatasourceAPIUid(amSourceName)}/api/v2/alerts`,
          params,
        };
      },
    }),

    getAlertmanagerAlertGroups: build.query<AlertmanagerGroup[], { amSourceName: string }>({
      query: ({ amSourceName }) => ({
        url: `/api/alertmanager/${getDatasourceAPIUid(amSourceName)}/api/v2/alerts/groups`,
      }),
    }),

    grafanaNotifiers: build.query<NotifierDTO[], void>({
      query: () => ({ url: '/api/alert-notifiers' }),
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

    // TODO we've sort of inherited the errors format here from the previous Redux actions, errors throw are of type "SerializedError"
    getAlertmanagerConfiguration: build.query<AlertManagerCortexConfig, string>({
      queryFn: async (alertmanagerSourceName: string) => {
        const isGrafanaManagedAlertmanager = alertmanagerSourceName === GRAFANA_RULES_SOURCE_NAME;
        const isVanillaPrometheusAlertmanager = isVanillaPrometheusAlertManagerDataSource(alertmanagerSourceName);

        // for vanilla prometheus, there is no config endpoint. Only fetch config from status
        if (isVanillaPrometheusAlertmanager) {
          return withSerializedError(
            fetchStatus(alertmanagerSourceName).then((status) => ({
              data: {
                alertmanager_config: status.config,
                template_files: {},
              },
            }))
          );
        }

        // discover features, we want to know if Mimir has "lazyConfigInit" configured
        const { data: alertmanagerFeatures } = await dispatch(
          featureDiscoveryApi.endpoints.discoverAmFeatures.initiate({
            amSourceName: alertmanagerSourceName,
          })
        );

        const defaultConfig = {
          alertmanager_config: {},
          template_files: {},
          template_file_provenances: {},
        };

        const lazyConfigInitSupported = alertmanagerFeatures?.lazyConfigInit ?? false;

        // wrap our fetchConfig function with some performance logging functions
        const fetchAMconfigWithLogging = withPerformanceLogging(
          fetchAlertManagerConfig,
          `[${alertmanagerSourceName}] Alertmanager config loaded`,
          {
            dataSourceName: alertmanagerSourceName,
            thunk: 'unifiedalerting/fetchAmConfig',
          }
        );

        const tryFetchingConfiguration = retryWhile(
          () => fetchAMconfigWithLogging(alertmanagerSourceName),
          // if config has been recently deleted, it takes a while for cortex start returning the default one.
          // retry for a short while instead of failing
          (error) =>
            !!messageFromError(error)?.includes('alertmanager storage object not found') && !lazyConfigInitSupported,
          FETCH_CONFIG_RETRY_TIMEOUT
        )
          .then((result) => {
            if (isGrafanaManagedAlertmanager) {
              return result;
            }

            // if user config is empty for Mimir alertmanager, try to get config from status endpoint
            const emptyConfiguration = isEmpty(result.alertmanager_config) && isEmpty(result.template_files);

            if (emptyConfiguration) {
              return fetchStatus(alertmanagerSourceName).then((status) => ({
                alertmanager_config: status.config,
                template_files: {},
                template_file_provenances: result.template_file_provenances,
                last_applied: result.last_applied,
                id: result.id,
              }));
            }

            return result;
          })
          .then((result) => result ?? defaultConfig)
          .then((result) => ({ data: result }))
          .catch((error) => {
            // When mimir doesn't have fallback AM url configured the default response will be as above
            // However it's fine, and it's possible to create AM configuration
            if (lazyConfigInitSupported && messageFromError(error)?.includes('alertmanager storage object not found')) {
              return {
                data: defaultConfig,
              };
            }

            throw error;
          });

        return withSerializedError(tryFetchingConfiguration).catch((err) => ({
          error: err,
          data: undefined,
        }));
      },
      providesTags: ['AlertmanagerConfiguration'],
    }),

    updateAlertmanagerConfiguration: build.mutation<
      void,
      { selectedAlertmanager: string; config: AlertManagerCortexConfig }
    >({
      query: ({ selectedAlertmanager, config, ...rest }) => ({
        url: `/api/alertmanager/${getDatasourceAPIUid(selectedAlertmanager)}/config/api/v1/alerts`,
        method: 'POST',
        data: config,
        ...rest,
      }),
      invalidatesTags: ['AlertmanagerConfiguration'],
    }),

    // Grafana Managed Alertmanager only
    getContactPointsStatus: build.query<ReceiversStateDTO[], void>({
      query: () => ({
        url: `/api/alertmanager/${getDatasourceAPIUid(GRAFANA_RULES_SOURCE_NAME)}/config/api/v1/receivers`,
      }),
      // this transformer basically fixes the weird "0001-01-01T00:00:00.000Z" and "0001-01-01T00:00:00.00Z" timestamps
      // and sets both last attempt and duration to an empty string to indicate there hasn't been an attempt yet
      transformResponse: (response: ReceiversStateDTO[]) => {
        const isLastNotifyNullDate = (lastNotify: string) => lastNotify.startsWith('0001-01-01');

        return response.map((receiversState) => ({
          ...receiversState,
          integrations: receiversState.integrations.map((integration) => {
            const noAttempt = isLastNotifyNullDate(integration.lastNotifyAttempt);

            return {
              ...integration,
              lastNotifyAttempt: noAttempt ? '' : integration.lastNotifyAttempt,
              lastNotifyAttemptDuration: noAttempt ? '' : integration.lastNotifyAttemptDuration,
            };
          }),
        }));
      },
    }),
  }),
});
