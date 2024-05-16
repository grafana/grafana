/**
 * Contains all handlers that are required for test rendering of components within Alerting
 */

import {
  alertmanagerAlertsListHandler,
  grafanaAlertingConfigurationStatusHandler,
} from 'app/features/alerting/unified/mocks/alertmanagerApi';
import { datasourceBuildInfoHandler } from 'app/features/alerting/unified/mocks/datasources';
import { folderHandler } from 'app/features/alerting/unified/mocks/folders';
import { pluginsHandler } from 'app/features/alerting/unified/mocks/plugins';
import {
  silenceCreateHandler,
  silenceGetHandler,
  silencesListHandler,
} from 'app/features/alerting/unified/mocks/silences';

import {
  getAlertRuleHandler,
  rulerRuleGroupHandler,
  rulerRuleNamespaceHandler,
  rulerRulesHandler,
} from '../alertRuleApi';

/**
 * All mock handlers that are required across Alerting tests
 */
const allHandlers = [
  grafanaAlertingConfigurationStatusHandler(),
  alertmanagerAlertsListHandler(),

  folderHandler(),

  pluginsHandler(),

  silencesListHandler(),
  silenceGetHandler(),
  silenceCreateHandler(),

  datasourceBuildInfoHandler(),

  rulerRulesHandler(),
  rulerRuleNamespaceHandler(),
  rulerRuleGroupHandler(),
  getAlertRuleHandler(),
];

export default allHandlers;
