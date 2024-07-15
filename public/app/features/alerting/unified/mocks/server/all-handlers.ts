/**
 * Contains all handlers that are required for test rendering of components within Alerting
 */

import alertmanagerHandlers from 'app/features/alerting/unified/mocks/server/handlers/alertmanagers';
import datasourcesHandlers from 'app/features/alerting/unified/mocks/server/handlers/datasources';
import evalHandlers from 'app/features/alerting/unified/mocks/server/handlers/eval';
import folderHandlers from 'app/features/alerting/unified/mocks/server/handlers/folders';
import grafanaRulerHandlers from 'app/features/alerting/unified/mocks/server/handlers/grafanaRuler';
import mimirRulerHandlers from 'app/features/alerting/unified/mocks/server/handlers/mimirRuler';
import pluginsHandlers from 'app/features/alerting/unified/mocks/server/handlers/plugins';
import provisioningHandlers from 'app/features/alerting/unified/mocks/server/handlers/provisioning';
import silenceHandlers from 'app/features/alerting/unified/mocks/server/handlers/silences';
import timeIntervalK8sHandlers from 'app/features/alerting/unified/mocks/server/handlers/timeIntervals.k8s';

/**
 * Array of all mock handlers that are required across Alerting tests
 */
const allHandlers = [
  ...grafanaRulerHandlers,
  ...mimirRulerHandlers,
  ...alertmanagerHandlers,
  ...datasourcesHandlers,
  ...evalHandlers,
  ...folderHandlers,
  ...pluginsHandlers,
  ...provisioningHandlers,
  ...silenceHandlers,

  // Kubernetes-style handlers
  ...timeIntervalK8sHandlers,
];

export default allHandlers;
