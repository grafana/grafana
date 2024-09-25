import { http, HttpResponse } from 'msw';

import alertmanagerConfigMock from 'app/features/alerting/unified/components/contact-points/__mocks__/alertmanager.config.mock.json';
import receiversMock from 'app/features/alerting/unified/components/contact-points/__mocks__/receivers.mock.json';
import { MOCK_SILENCE_ID_EXISTING, mockAlertmanagerAlert } from 'app/features/alerting/unified/mocks';
import { defaultGrafanaAlertingConfigurationStatusResponse } from 'app/features/alerting/unified/mocks/alertmanagerApi';
import { MOCK_DATASOURCE_UID_BROKEN_ALERTMANAGER } from 'app/features/alerting/unified/mocks/server/handlers/datasources';
import { GRAFANA_RULES_SOURCE_NAME } from 'app/features/alerting/unified/utils/datasource';
import { AlertManagerCortexConfig, AlertState } from 'app/plugins/datasource/alertmanager/types';

export const grafanaAlertingConfigurationStatusHandler = (
  response = defaultGrafanaAlertingConfigurationStatusResponse
) => http.get('/api/v1/ngalert', () => HttpResponse.json(response));

const getInvalidMatcher = (matchers: string[]) => {
  return matchers.find((matcher) => {
    const split = matcher.split('=');
    try {
      // Try and parse as JSON, as this will fail if
      // we've failed to wrap the label value in quotes
      // (e.g. `foo space` can't be parsed, but `"foo space"` can)
      JSON.parse(split[0]);
      return false;
    } catch (e) {
      return true;
    }
  });
};

export const alertmanagerAlertsListHandler = () =>
  http.get<{ datasourceUid: string }>('/api/alertmanager/:datasourceUid/api/v2/alerts', ({ params, request }) => {
    const matchers = new URL(request.url).searchParams.getAll('filter');

    const invalidMatcher = getInvalidMatcher(matchers);

    if (invalidMatcher) {
      return HttpResponse.json(
        {
          message: `bad matcher format: ${invalidMatcher}: unable to retrieve alerts`,
          traceID: '',
        },
        { status: 400 }
      );
    }

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

export const ALERTMANAGER_UPDATE_ERROR_RESPONSE = HttpResponse.json({ message: 'bad request' }, { status: 400 });

/** Perform some basic validation on the config that we expect the backend to also do */
const validateGrafanaAlertmanagerConfig = (config: AlertManagerCortexConfig) => {
  const { alertmanager_config } = config;
  const { route, time_intervals = [], mute_time_intervals = [] } = alertmanager_config;

  const intervals = [...time_intervals, ...mute_time_intervals];
  const intervalsByName = new Set(intervals.map((interval) => interval.name));
  const duplicatedIntervals = intervalsByName.size !== intervals.length;

  let routesReferencingMissingMuteTimings = false;

  if (route) {
    routesReferencingMissingMuteTimings = Boolean(
      route.routes?.find((route) => {
        return route.mute_time_intervals?.some((name) => !intervalsByName.has(name));
      })
    );
  }

  if (routesReferencingMissingMuteTimings || duplicatedIntervals) {
    return ALERTMANAGER_UPDATE_ERROR_RESPONSE;
  }

  return null;
};

export const updateGrafanaAlertmanagerConfigHandler = (responseOverride?: typeof ALERTMANAGER_UPDATE_ERROR_RESPONSE) =>
  http.post('/api/alertmanager/grafana/config/api/v1/alerts', async ({ request }) => {
    if (responseOverride) {
      return responseOverride;
    }
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

const getReceiversHandler = () =>
  http.get<{ datasourceUid: string }>('/api/alertmanager/:datasourceUid/config/api/v1/receivers', ({ params }) => {
    if (params.datasourceUid === GRAFANA_RULES_SOURCE_NAME) {
      return HttpResponse.json(receiversMock);
    }
    // API does not exist for non-Grafana alertmanager,
    // and UI uses this as heuristic to work out how to render in notification policies
    return HttpResponse.json({ message: 'Not found.' }, { status: 404 });
  });

const testReceiversHandler = () =>
  http.post('/api/alertmanager/grafana/config/api/v1/receivers/test', () => {
    // TODO: scaffold out response as needed by tests
    return HttpResponse.json({});
  });

const getGroupsHandler = () =>
  http.get<{ datasourceUid: string }>('/api/alertmanager/:datasourceUid/api/v2/alerts/groups', () =>
    // TODO: Scaffold out response with better data as required by tests
    HttpResponse.json([])
  );

const handlers = [
  alertmanagerAlertsListHandler(),
  grafanaAlertingConfigurationStatusHandler(),
  getGrafanaAlertmanagerConfigHandler(),
  getAlertmanagerConfigHandler(),
  updateGrafanaAlertmanagerConfigHandler(),
  updateAlertmanagerConfigHandler(),
  getGrafanaAlertmanagerTemplatePreview(),
  getReceiversHandler(),
  testReceiversHandler(),
  getGroupsHandler(),
];
export default handlers;
