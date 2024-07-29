/**
 * Contains all handlers that are required for test rendering of components within Alerting
 */

import alertNotifierHandlers from 'app/features/alerting/unified/mocks/server/handlers/alertNotifiers';
import alertmanagerHandlers from 'app/features/alerting/unified/mocks/server/handlers/alertmanagers';
import datasourcesHandlers from 'app/features/alerting/unified/mocks/server/handlers/datasources';
import evalHandlers from 'app/features/alerting/unified/mocks/server/handlers/eval';
import folderHandlers from 'app/features/alerting/unified/mocks/server/handlers/folders';
import grafanaRulerHandlers from 'app/features/alerting/unified/mocks/server/handlers/grafanaRuler';
import mimirRulerHandlers from 'app/features/alerting/unified/mocks/server/handlers/mimirRuler';
import pluginsHandlers from 'app/features/alerting/unified/mocks/server/handlers/plugins';
import allPluginHandlers from 'app/features/alerting/unified/mocks/server/handlers/plugins/all-plugin-handlers';
import silenceHandlers from 'app/features/alerting/unified/mocks/server/handlers/silences';
/**
 * Array of all mock handlers that are required across Alerting tests
 */
const allHandlers = [
  ...alertNotifierHandlers,
  ...grafanaRulerHandlers,
  ...mimirRulerHandlers,
  ...alertmanagerHandlers,
  ...datasourcesHandlers,
  ...evalHandlers,
  ...folderHandlers,
  ...pluginsHandlers,
  ...silenceHandlers,

  ...allPluginHandlers,
];

export default allHandlers;
