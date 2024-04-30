/**
 * Contains all handlers that are required for test rendering of components within Alerting
 */

import {
  alertmanagerAlertsListHandler,
  grafanaAlertingConfigurationStatusHandler,
} from 'app/features/alerting/unified/mocks/alertmanagerApi';
import { datasourceBuildInfoHandler } from 'app/features/alerting/unified/mocks/datasources';
import {
  silenceCreateHandler,
  silenceGetHandler,
  silencesListHandler,
} from 'app/features/alerting/unified/mocks/silences';

/**
 * All mock handlers that are required across Alerting tests
 */
const allHandlers = [
  grafanaAlertingConfigurationStatusHandler(),
  alertmanagerAlertsListHandler(),

  silencesListHandler(),
  silenceGetHandler(),
  silenceCreateHandler(),

  datasourceBuildInfoHandler(),
];

export default allHandlers;
