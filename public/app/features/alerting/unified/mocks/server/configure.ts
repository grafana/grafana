import { HttpResponse } from 'msw';

import server from 'app/features/alerting/unified/mockApi';
import { mockFolder } from 'app/features/alerting/unified/mocks';
import {
  getGrafanaAlertmanagerConfigHandler,
  grafanaAlertingConfigurationStatusHandler,
} from 'app/features/alerting/unified/mocks/server/handlers/alertmanagers';
import { getFolderHandler } from 'app/features/alerting/unified/mocks/server/handlers/folders';
import { AlertManagerCortexConfig, AlertmanagerChoice } from 'app/plugins/datasource/alertmanager/types';
import { FolderDTO } from 'app/types';

import { rulerRuleGroupHandler, updateRulerRuleNamespaceHandler } from './handlers/alertRules';

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
 * Makes the mock server respond with different responses for updating a ruler namespace
 */
export const setUpdateRulerRuleNamespaceHandler = (options?: HandlerOptions) => {
  const handler = updateRulerRuleNamespaceHandler(options);
  server.use(handler);

  return handler;
};

/**
 * Makes the mock server response with different responses for a ruler rule group
 */
export const setRulerRuleGroupHandler = (options?: HandlerOptions) => {
  const handler = rulerRuleGroupHandler(options);
  server.use(handler);

  return handler;
};
