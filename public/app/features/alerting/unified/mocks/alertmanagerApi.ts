import 'whatwg-fetch';
import { http, HttpResponse } from 'msw';
import { SetupServer } from 'msw/node';

import {
  AlertmanagerChoice,
  AlertManagerCortexConfig,
  ExternalAlertmanagersResponse,
} from '../../../../plugins/datasource/alertmanager/types';
import { AlertmanagersChoiceResponse } from '../api/alertmanagerApi';
import { getDatasourceAPIUid } from '../utils/datasource';

export const defaultAlertmanagerChoiceResponse: AlertmanagersChoiceResponse = {
  alertmanagersChoice: AlertmanagerChoice.Internal,
  numExternalAlertmanagers: 0,
};
export function mockAlertmanagerChoiceResponse(server: SetupServer, response: AlertmanagersChoiceResponse) {
  server.use(http.get('/api/v1/ngalert', () => HttpResponse.json(response)));
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
