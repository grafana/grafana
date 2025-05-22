import { HttpResponse, JsonBodyType, StrictResponse, http } from 'msw';

import { TemplatesTestPayload } from 'app/features/alerting/unified/api/templateApi';
import receiversMock from 'app/features/alerting/unified/components/contact-points/__mocks__/receivers.mock.json';
import { MOCK_SILENCE_ID_EXISTING, mockAlertmanagerAlert } from 'app/features/alerting/unified/mocks';
import { defaultGrafanaAlertingConfigurationStatusResponse } from 'app/features/alerting/unified/mocks/alertmanagerApi';
import {
  getAlertmanagerConfig,
  getAlertmanagerStatus,
  setAlertmanagerConfig,
} from 'app/features/alerting/unified/mocks/server/entities/alertmanagers';
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

export const getAlertmanagerConfigHandler = (responseOverride?: StrictResponse<JsonBodyType>) =>
  http.get<{ name: string }>('/api/alertmanager/:name/config/api/v1/alerts', ({ params }) => {
    if (responseOverride) {
      return responseOverride;
    }
    const { name: alertmanagerName } = params;

    const configToReturn = getAlertmanagerConfig(alertmanagerName);

    if (configToReturn) {
      return HttpResponse.json(configToReturn);
    }
    return HttpResponse.json({ message: 'Not found.' }, { status: 404 });
  });

const getAlertmanagerStatusHandler = () =>
  http.get<{ name: string }>('/api/alertmanager/:name/api/v2/status', ({ params }) => {
    const { name: alertmanagerName } = params;

    const statusToReturn = getAlertmanagerStatus(alertmanagerName);

    if (statusToReturn) {
      return HttpResponse.json(statusToReturn);
    }
    return HttpResponse.json({ message: 'data source not found', traceID: '' }, { status: 404 });
  });

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

export const updateAlertmanagerConfigHandler = (responseOverride?: typeof ALERTMANAGER_UPDATE_ERROR_RESPONSE) =>
  http.post<{ name: string }>('/api/alertmanager/:name/config/api/v1/alerts', async ({ request, params }) => {
    if (responseOverride) {
      return responseOverride;
    }
    const { name: alertmanagerName } = params;
    const body: AlertManagerCortexConfig = await request.clone().json();
    // TODO: Validate the config depending on alertmanager type
    // e.g. validate other AMs differently where required for tests
    const potentialError = validateGrafanaAlertmanagerConfig(body);
    if (!potentialError) {
      // Only update the mock entity the endpoint is going to "succeed"
      setAlertmanagerConfig(alertmanagerName, body);
    }
    return potentialError ? potentialError : HttpResponse.json({ message: 'configuration created' });
  });

const getGrafanaAlertmanagerTemplatePreview = () =>
  http.post<never, TemplatesTestPayload>(
    '/api/alertmanager/grafana/config/api/v1/templates/test',
    async ({ request }) => {
      const body = await request.json();

      if (body?.template.startsWith('{{')) {
        return HttpResponse.json({ results: [{ name: 'asdasd', text: `some example preview for ${body.template}` }] });
      }

      return HttpResponse.json({});
    }
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
  getAlertmanagerConfigHandler(),
  updateAlertmanagerConfigHandler(),
  getGrafanaAlertmanagerTemplatePreview(),
  getReceiversHandler(),
  testReceiversHandler(),
  getGroupsHandler(),
  getAlertmanagerStatusHandler(),
];
export default handlers;
