/**
 * Contains all handlers that are required for test rendering of components within Alerting
 */

import {
  alertmanagerAlertsListHandler,
  alertmanagerChoiceHandler,
} from 'app/features/alerting/unified/mocks/alertmanagerApi';
import { datasourceBuildInfoHandler } from 'app/features/alerting/unified/mocks/datasources';
import { silenceCreateHandler, silencesListHandler } from 'app/features/alerting/unified/mocks/silences';

/**
 * All mock handlers that are required across Alerting tests
 */
const allHandlers = [
  alertmanagerChoiceHandler(),
  silencesListHandler(),
  silenceCreateHandler(),
  alertmanagerAlertsListHandler(),
  datasourceBuildInfoHandler(),
];

export default allHandlers;
