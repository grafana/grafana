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

export const getAlertmanagerConfigHandler = (config: AlertManagerCortexConfig = alertmanagerConfigMock) =>
  http.get('/api/alertmanager/:name/config/api/v1/alerts', () => HttpResponse.json(config));

const alertmanagerUpdateError = HttpResponse.json({ message: 'bad request' }, { status: 400 });

/** Perform some basic validation on the config that we expect the backend to also do */
const validateGrafanaAlertmanagerConfig = (config: AlertManagerCortexConfig) => {
  const { alertmanager_config } = config;
  const { route, time_intervals = [], mute_time_intervals = [] } = alertmanager_config;

  const intervals = [...time_intervals, ...mute_time_intervals];
  const intervalsByName = new Set(intervals.map((interval) => interval.name));
  const duplicatedIntervals = intervalsByName.size !== intervals.length;

  if (route) {
    const routesReferencingMissingMuteTimings = Boolean(
      route.routes?.find((route) => {
        return route.mute_time_intervals?.some((name) => !intervalsByName.has(name));
      })
    );

    if (routesReferencingMissingMuteTimings) {
      return alertmanagerUpdateError;
    }
  }

  if (duplicatedIntervals) {
    return alertmanagerUpdateError;
  }

  return null;
};

const updateGrafanaAlertmanagerConfigHandler = () =>
  http.post('/api/alertmanager/grafana/config/api/v1/alerts', async ({ request }) => {
    const body: AlertManagerCortexConfig = await request.clone().json();
    const potentialError = validateGrafanaAlertmanagerConfig(body);
    return potentialError ? potentialError : HttpResponse.json({ message: 'configuration created' });
  });

const updateAlertmanagerConfigHandler = () =>
  http.post('/api/alertmanager/:name/config/api/v1/alerts', async ({ request }) => {
    const body: AlertManagerCortexConfig = await request.clone().json();
    const potentialError = validateGrafanaAlertmanagerConfig(body);
    return potentialError ? potentialError : HttpResponse.json({ message: 'configuration created' });
  });

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
  getAlertmanagerConfigHandler(),
  updateGrafanaAlertmanagerConfigHandler(),
  updateAlertmanagerConfigHandler(),
  getGrafanaAlertmanagerTemplatePreview(),
  getGrafanaReceiversHandler(),
];
export default handlers;
