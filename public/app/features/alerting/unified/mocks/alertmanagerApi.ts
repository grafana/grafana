import { http, HttpResponse } from 'msw';
import { SetupServer } from 'msw/node';

import { mockAlertmanagerAlert } from 'app/features/alerting/unified/mocks';

import {
  AlertmanagerChoice,
  AlertManagerCortexConfig,
  AlertState,
  ExternalAlertmanagersResponse,
} from '../../../../plugins/datasource/alertmanager/types';
import { AlertmanagersChoiceResponse } from '../api/alertmanagerApi';
import { getDatasourceAPIUid } from '../utils/datasource';

export const defaultAlertmanagerChoiceResponse: AlertmanagersChoiceResponse = {
  alertmanagersChoice: AlertmanagerChoice.Internal,
  numExternalAlertmanagers: 0,
};

export const alertmanagerChoiceHandler = (response = defaultAlertmanagerChoiceResponse) =>
  http.get('/api/v1/ngalert', () => HttpResponse.json(response));

export function mockAlertmanagerChoiceResponse(server: SetupServer, response: AlertmanagersChoiceResponse) {
  server.use(alertmanagerChoiceHandler(response));
}

export const emptyExternalAlertmanagersResponse: ExternalAlertmanagersResponse = {
  data: {
    droppedAlertManagers: [],
    activeAlertManagers: [],
  },
};
export function mockAlertmanagersResponse(server: SetupServer, response: ExternalAlertmanagersResponse) {
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
  http.get('/api/alertmanager/:datasourceUid/api/v2/alerts', () =>
    HttpResponse.json([
      mockAlertmanagerAlert({
        labels: { foo: 'bar', buzz: 'bazz' },
        status: { state: AlertState.Suppressed, silencedBy: ['12345'], inhibitedBy: [] },
      }),
      mockAlertmanagerAlert({
        labels: { foo: 'bar', buzz: 'bazz' },
        status: { state: AlertState.Suppressed, silencedBy: ['12345'], inhibitedBy: [] },
      }),
    ])
  );
