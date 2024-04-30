import { http, HttpResponse } from 'msw';
import { SetupServer } from 'msw/node';

import { MOCK_SILENCE_ID_EXISTING, mockAlertmanagerAlert } from 'app/features/alerting/unified/mocks';
import { MOCK_DATASOURCE_UID_BROKEN_ALERTMANAGER } from 'app/features/alerting/unified/mocks/datasources';

import {
  AlertmanagerChoice,
  AlertManagerCortexConfig,
  AlertState,
  ExternalAlertmanagersStatusResponse,
} from '../../../../plugins/datasource/alertmanager/types';
import { GrafanaAlertingConfigurationStatusResponse } from '../api/alertmanagerApi';
import { getDatasourceAPIUid } from '../utils/datasource';

export const defaultGrafanaAlertingConfigurationStatusResponse: GrafanaAlertingConfigurationStatusResponse = {
  alertmanagersChoice: AlertmanagerChoice.Internal,
  numExternalAlertmanagers: 0,
};

export const grafanaAlertingConfigurationStatusHandler = (
  response = defaultGrafanaAlertingConfigurationStatusResponse
) => http.get('/api/v1/ngalert', () => HttpResponse.json(response));

export function mockAlertmanagerChoiceResponse(
  server: SetupServer,
  response: GrafanaAlertingConfigurationStatusResponse
) {
  server.use(grafanaAlertingConfigurationStatusHandler(response));
}

export const emptyExternalAlertmanagersResponse: ExternalAlertmanagersStatusResponse = {
  data: {
    droppedAlertManagers: [],
    activeAlertManagers: [],
  },
};
export function mockAlertmanagersResponse(server: SetupServer, response: ExternalAlertmanagersStatusResponse) {
  server.use(http.get('/api/v1/ngalert/alertmanagers', () => HttpResponse.json(response)));
}

export function mockAlertmanagerConfigResponse(
  server: SetupServer,
  alertManagerSourceName: string,
  response: AlertManagerCortexConfig
) {
  server.use(
    http.get(`/api/alertmanager/${getDatasourceAPIUid(alertManagerSourceName)}/config/api/v1/alerts`, () =>
      HttpResponse.json(response)
    )
  );
}

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
