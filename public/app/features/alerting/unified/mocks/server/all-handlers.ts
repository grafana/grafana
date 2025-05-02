/**
 * Contains all handlers that are required for test rendering of components within Alerting
 */

import accessControlHandlers from 'app/features/alerting/unified/mocks/server/handlers/accessControl';
import alertNotifierHandlers from 'app/features/alerting/unified/mocks/server/handlers/alertNotifiers';
import alertmanagerHandlers from 'app/features/alerting/unified/mocks/server/handlers/alertmanagers';
import datasourcesHandlers from 'app/features/alerting/unified/mocks/server/handlers/datasources';
import evalHandlers from 'app/features/alerting/unified/mocks/server/handlers/eval';
import folderHandlers from 'app/features/alerting/unified/mocks/server/handlers/folders';
import grafanaRulerHandlers from 'app/features/alerting/unified/mocks/server/handlers/grafanaRuler';
import receiverK8sHandlers from 'app/features/alerting/unified/mocks/server/handlers/k8s/receivers.k8s';
import routingTreeK8sHandlers from 'app/features/alerting/unified/mocks/server/handlers/k8s/routingtrees.k8s';
import templatesK8sHandlers from 'app/features/alerting/unified/mocks/server/handlers/k8s/templates.k8s';
import timeIntervalK8sHandlers from 'app/features/alerting/unified/mocks/server/handlers/k8s/timeIntervals.k8s';
import mimirRulerHandlers from 'app/features/alerting/unified/mocks/server/handlers/mimirRuler';
import notificationsHandlers from 'app/features/alerting/unified/mocks/server/handlers/notifications';
import pluginsHandlers from 'app/features/alerting/unified/mocks/server/handlers/plugins';
import allPluginHandlers from 'app/features/alerting/unified/mocks/server/handlers/plugins/all-plugin-handlers';
import provisioningHandlers from 'app/features/alerting/unified/mocks/server/handlers/provisioning';
import searchHandlers from 'app/features/alerting/unified/mocks/server/handlers/search';
import silenceHandlers from 'app/features/alerting/unified/mocks/server/handlers/silences';

/**
 * Array of all mock handlers that are required across Alerting tests
 * @deprecated Move to `@grafana/test-utils` instead
 */
const allHandlers = [
  ...accessControlHandlers,
  ...alertNotifierHandlers,
  ...grafanaRulerHandlers,
  ...mimirRulerHandlers,
  ...alertmanagerHandlers,
  ...datasourcesHandlers,
  ...evalHandlers,
  ...folderHandlers,
  ...pluginsHandlers,
  ...provisioningHandlers,
  ...silenceHandlers,
  ...searchHandlers,
  ...notificationsHandlers,

  ...allPluginHandlers,

  // Kubernetes-style handlers
  ...timeIntervalK8sHandlers,
  ...receiverK8sHandlers,
  ...templatesK8sHandlers,
  ...routingTreeK8sHandlers,
];

export default allHandlers;
