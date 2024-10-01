import { HttpResponse, http } from 'msw';

import { ONCALL_INTEGRATION_V2_FEATURE, OnCallIntegrationDTO } from 'app/features/alerting/unified/api/onCallApi';

const BASE_URL = `/api/plugin-proxy/grafana-oncall-app`;

export const getOnCallIntegrationsHandler = (receiveChannels: OnCallIntegrationDTO[] = []) =>
  http.get(`${BASE_URL}/api/internal/v1/alert_receive_channels`, () => {
    return HttpResponse.json(receiveChannels);
  });

export const getFeaturesHandler = (features = [ONCALL_INTEGRATION_V2_FEATURE]) =>
  http.get(`${BASE_URL}/api/internal/v1/features`, () => {
    return HttpResponse.json(features);
  });

const validateIntegrationNameHandler = (
  invalidNames: string[] = ['grafana-integration', 'alertmanager-integration']
) => {
  return http.get(`${BASE_URL}/api/internal/v1/alert_receive_channels/validate_name`, ({ request }) => {
    const url = new URL(request.url);
    const isValid = !invalidNames.includes(url.searchParams.get('verbal_name') ?? '');
    return HttpResponse.json(isValid, {
      status: isValid ? 200 : 409,
    });
  });
};

const handlers = [getOnCallIntegrationsHandler(), getFeaturesHandler(), validateIntegrationNameHandler()];
export default handlers;
