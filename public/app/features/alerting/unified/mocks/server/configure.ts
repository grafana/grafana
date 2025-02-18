import { HttpResponse, http } from 'msw';

import { DataSourceInstanceSettings } from '@grafana/data';
import { config } from '@grafana/runtime';
import server from 'app/features/alerting/unified/mockApi';
import { mockDataSource, mockFolder } from 'app/features/alerting/unified/mocks';
import {
  getAlertmanagerConfigHandler,
  grafanaAlertingConfigurationStatusHandler,
  updateAlertmanagerConfigHandler,
} from 'app/features/alerting/unified/mocks/server/handlers/alertmanagers';
import { getFolderHandler } from 'app/features/alerting/unified/mocks/server/handlers/folders';
import { listNamespacedTimeIntervalHandler } from 'app/features/alerting/unified/mocks/server/handlers/k8s/timeIntervals.k8s';
import {
  getDisabledPluginHandler,
  getPluginMissingHandler,
} from 'app/features/alerting/unified/mocks/server/handlers/plugins';
import { ALERTING_API_SERVER_BASE_URL, paginatedHandlerFor } from 'app/features/alerting/unified/mocks/server/utils';
import { SupportedPlugin } from 'app/features/alerting/unified/types/pluginBridges';
import { clearPluginSettingsCache } from 'app/features/plugins/pluginSettings';
import { AlertmanagerChoice } from 'app/plugins/datasource/alertmanager/types';
import { FolderDTO } from 'app/types';
import { RulerDataSourceConfig } from 'app/types/unified-alerting';
import { PromRuleGroupDTO } from 'app/types/unified-alerting-dto';

import { setupDataSources } from '../../testSetup/datasources';
import { DataSourceType } from '../../utils/datasource';
import { ApiMachineryError } from '../../utils/k8s/errors';

import { MIMIR_DATASOURCE_UID } from './constants';
import { rulerRuleGroupHandler, updateRulerRuleNamespaceHandler } from './handlers/grafanaRuler';

export type HandlerOptions = {
  delay?: number;
  response?: HttpResponse;
};

/**
 * Makes the mock server respond in a way that matches the different behaviour associated with
 * Alertmanager choices and the number of configured external alertmanagers
 */
export const setAlertmanagerChoices = (alertmanagersChoice: AlertmanagerChoice, numExternalAlertmanagers: number) => {
  const response = {
    alertmanagersChoice,
    numExternalAlertmanagers,
  };
  server.use(grafanaAlertingConfigurationStatusHandler(response));
};

/**
 * Makes the mock server respond with different folder access control settings
 */
export const setFolderAccessControl = (accessControl: FolderDTO['accessControl']) => {
  server.use(getFolderHandler(mockFolder({ hasAcl: true, accessControl })));
};

/**
 * Makes the mock server respond with different folder response, for just the folder in question
 */
export const setFolderResponse = (response: Partial<FolderDTO>) => {
  const handler = http.get<{ folderUid: string }>(`/api/folders/${response.uid}`, () => HttpResponse.json(response));
  server.use(handler);
};

/**
 * Makes the mock server respond with different responses for updating a ruler namespace
 */
export const setUpdateRulerRuleNamespaceHandler = (options?: HandlerOptions) => {
  const handler = updateRulerRuleNamespaceHandler(options);
  server.use(handler);

  return handler;
};

/**
 * Makes the mock server respond with different responses for a ruler rule group
 */
export const setRulerRuleGroupHandler = (options?: HandlerOptions) => {
  const handler = rulerRuleGroupHandler(options);
  server.use(handler);

  return handler;
};

/**
 * Makes the mock server respond with an error when fetching list of mute timings
 */
export const setMuteTimingsListError = () => {
  const listMuteTimingsPath = listNamespacedTimeIntervalHandler().info.path;
  const handler = http.get(listMuteTimingsPath, () => {
    return HttpResponse.json({}, { status: 401 });
  });

  server.use(handler);
  return handler;
};

export function mimirDataSource() {
  const dataSource = mockDataSource(
    {
      type: DataSourceType.Prometheus,
      name: MIMIR_DATASOURCE_UID,
      uid: MIMIR_DATASOURCE_UID,
      jsonData: {
        manageAlerts: true,
        implementation: 'mimir',
      },
    },
    { alerting: true, module: 'core:plugin/prometheus' }
  );

  const rulerConfig: RulerDataSourceConfig = {
    apiVersion: 'config',
    dataSourceUid: dataSource.uid,
    dataSourceName: dataSource.name,
  };

  setupDataSources(dataSource);

  return { dataSource, rulerConfig };
}

export function setPrometheusRules(ds: DataSourceInstanceSettings, groups: PromRuleGroupDTO[]) {
  server.use(http.get(`/api/prometheus/${ds.uid}/api/v1/rules`, paginatedHandlerFor(groups)));
}

/** Make a given plugin ID respond with a 404, as if it isn't installed at all */
export const removePlugin = (pluginId: string) => {
  delete config.apps[pluginId];
  server.use(getPluginMissingHandler(pluginId));
};

/** Make a plugin respond with `enabled: false`, as if its installed but disabled */
export const disablePlugin = (pluginId: SupportedPlugin) => {
  clearPluginSettingsCache(pluginId);
  server.use(getDisabledPluginHandler(pluginId));
};

/** Get an error response for use in a API response, in the format:
 * ```
 * {
 *   message: string,
 * }
 * ```
 */
export const getErrorResponse = (message: string, status = 500) => HttpResponse.json({ message }, { status });

const defaultError = getErrorResponse('Unknown error');
/** Make alertmanager config update fail */
export const makeAlertmanagerConfigUpdateFail = (
  responseOverride: ReturnType<typeof getErrorResponse> = defaultError
) => {
  server.use(updateAlertmanagerConfigHandler(responseOverride));
};

/** Make fetching alertmanager config fail */
export const makeAllAlertmanagerConfigFetchFail = (
  responseOverride: ReturnType<typeof getErrorResponse> = defaultError
) => {
  server.use(getAlertmanagerConfigHandler(responseOverride));
};

export const makeAllK8sGetEndpointsFail = (
  uid: string,
  message = 'could not find an Alertmanager configuration',
  status = 500
) => {
  server.use(
    http.get(ALERTING_API_SERVER_BASE_URL + '/*', () => {
      const errorResponse: ApiMachineryError = {
        kind: 'Status',
        apiVersion: 'v1',
        metadata: {},
        status: 'Failure',
        details: {
          uid,
        },
        message,
        code: status,
        reason: '',
      };
      return HttpResponse.json<ApiMachineryError>(errorResponse, { status });
    })
  );
};
