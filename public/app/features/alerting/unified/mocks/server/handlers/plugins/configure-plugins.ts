import { OnCallIntegrationDTO } from 'app/features/alerting/unified/api/onCallApi';
import server from 'app/features/alerting/unified/mockApi';
import {
  getFeaturesHandler,
  getOnCallIntegrationsHandler,
} from 'app/features/alerting/unified/mocks/server/handlers/plugins/grafana-oncall';

export const setOnCallFeatures = (features: string[]) => {
  server.use(getFeaturesHandler(features));
};

export const setOnCallIntegrations = (integrations: OnCallIntegrationDTO[]) => {
  server.use(getOnCallIntegrationsHandler(integrations));
};
