import { http, HttpResponse } from 'msw';

import alertmanagerConfigMock from 'app/features/alerting/unified/components/contact-points/__mocks__/alertmanager.config.mock.json';
import receiversMock from 'app/features/alerting/unified/components/contact-points/__mocks__/receivers.mock.json';
import { MOCK_SILENCE_ID_EXISTING, mockAlertmanagerAlert } from 'app/features/alerting/unified/mocks';
import { defaultGrafanaAlertingConfigurationStatusResponse } from 'app/features/alerting/unified/mocks/alertmanagerApi';
import { MOCK_DATASOURCE_UID_BROKEN_ALERTMANAGER } from 'app/features/alerting/unified/mocks/server/handlers/datasources';
import { AlertManagerCortexConfig, AlertState } from 'app/plugins/datasource/alertmanager/types';

export const grafanaAlertingConfigurationStatusHandler = (
  response = defaultGrafanaAlertingConfigurationStatusResponse
) => http.get('/api/v1/ngalert', () => HttpResponse.json(response));

export const alertmanagerAlertsListHandler = () =>
  http.get<{ datasourceUid: string }>('/api/alertmanager/:datasourceUid/api/v2/alerts', ({ params }) => {
    if (params.datasourceUid === MOCK_DATASOURCE_UID_BROKEN_ALERTMANAGER) {
      return HttpResponse.json({ traceId: '' }, { status: 502 });
    }
    return HttpResponse.json([
      mockAlertmanagerAlert({
        labels: { foo: 'bar', buzz: 'bazz' },
        status: { state: AlertState.Suppressed, silencedBy: [MOCK_SILENCE_ID_EXISTING], inhibitedBy: [] },
      }),
      mockAlertmanagerAlert({
        labels: { foo: 'bar', buzz: 'bazz' },
        status: { state: AlertState.Suppressed, silencedBy: [MOCK_SILENCE_ID_EXISTING], inhibitedBy: [] },
      }),
    ]);
  });

export const getGrafanaAlertmanagerConfigHandler = (config: AlertManagerCortexConfig = alertmanagerConfigMock) =>
  http.get('/api/alertmanager/grafana/config/api/v1/alerts', () => HttpResponse.json(config));

const updateGrafanaAlertmanagerConfigHandler = () =>
  http.post('/api/alertmanager/grafana/config/api/v1/alerts', () =>
    HttpResponse.json({ message: 'configuration created' })
  );

const getGrafanaAlertmanagerTemplatePreview = () =>
  http.post('/api/alertmanager/grafana/config/api/v1/templates/test', () =>
    // TODO: Scaffold out template preview response as needed by tests
    HttpResponse.json({})
  );

const getGrafanaReceiversHandler = () =>
  http.get('/api/alertmanager/grafana/config/api/v1/receivers', () => HttpResponse.json(receiversMock));

const handlers = [
  alertmanagerAlertsListHandler(),
  grafanaAlertingConfigurationStatusHandler(),
  getGrafanaAlertmanagerConfigHandler(),
  updateGrafanaAlertmanagerConfigHandler(),
  getGrafanaAlertmanagerTemplatePreview(),
  getGrafanaReceiversHandler(),
];
export default handlers;
