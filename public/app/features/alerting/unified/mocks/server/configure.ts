import { HttpResponse, http } from 'msw';

import { config } from '@grafana/runtime';
import server, { mockFeatureDiscoveryApi } from 'app/features/alerting/unified/mockApi';
import { mockDataSource, mockFolder } from 'app/features/alerting/unified/mocks';
import {
  ALERTMANAGER_UPDATE_ERROR_RESPONSE,
  getAlertmanagerConfigHandler,
  getGrafanaAlertmanagerConfigHandler,
  grafanaAlertingConfigurationStatusHandler,
  updateGrafanaAlertmanagerConfigHandler,
} from 'app/features/alerting/unified/mocks/server/handlers/alertmanagers';
import { getFolderHandler } from 'app/features/alerting/unified/mocks/server/handlers/folders';
import { listNamespacedTimeIntervalHandler } from 'app/features/alerting/unified/mocks/server/handlers/k8s/timeIntervals.k8s';
import {
  getDisabledPluginHandler,
  getPluginMissingHandler,
} from 'app/features/alerting/unified/mocks/server/handlers/plugins';
import { SupportedPlugin } from 'app/features/alerting/unified/types/pluginBridges';
import { AlertManagerCortexConfig, AlertmanagerChoice } from 'app/plugins/datasource/alertmanager/types';
import { FolderDTO } from 'app/types';

import { setupDataSources } from '../../testSetup/datasources';
import { buildInfoResponse } from '../../testSetup/featureDiscovery';
import { DataSourceType } from '../../utils/datasource';

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
 * Makes the mock server respond with different Grafana Alertmanager config
 */
export const setGrafanaAlertmanagerConfig = (config: AlertManagerCortexConfig) => {
  server.use(getGrafanaAlertmanagerConfigHandler(config));
};

/**
 * Makes the mock server respond with different (other) Alertmanager config
 */
export const setAlertmanagerConfig = (config: AlertManagerCortexConfig) => {
  server.use(getAlertmanagerConfigHandler(config));
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
      url: 'https://mimir.local:9000',
      jsonData: {
        manageAlerts: true,
      },
    },
    { alerting: true }
  );

  setupDataSources(dataSource);
  mockFeatureDiscoveryApi(server).discoverDsFeatures(dataSource, buildInfoResponse.mimir);

  return { dataSource };
}

/** Make a given plugin ID respond with a 404, as if it isn't installed at all */
export const removePlugin = (pluginId: string) => {
  delete config.apps[pluginId];
  server.use(getPluginMissingHandler(pluginId));
};

/** Make a plugin respond with `enabled: false`, as if its installed but disabled */
export const disablePlugin = (pluginId: SupportedPlugin) => {
  server.use(getDisabledPluginHandler(pluginId));
};

/** Make alertmanager config update fail */
export const makeGrafanaAlertmanagerConfigUpdateFail = () => {
  server.use(updateGrafanaAlertmanagerConfigHandler(ALERTMANAGER_UPDATE_ERROR_RESPONSE));
};
