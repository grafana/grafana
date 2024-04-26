import { http, HttpResponse } from 'msw';
import { SetupServer } from 'msw/node';

import {
  AlertmanagerChoice,
  AlertManagerCortexConfig,
  ExternalAlertmanagersStatusResponse,
} from '../../../../plugins/datasource/alertmanager/types';
import { GrafanaAlertingConfigurationStatusResponse } from '../api/alertmanagerApi';
import { getDatasourceAPIUid } from '../utils/datasource';

export const defaultAlertmanagerChoiceResponse: GrafanaAlertingConfigurationStatusResponse = {
  alertmanagersChoice: AlertmanagerChoice.Internal,
  numExternalAlertmanagers: 0,
};
export function mockAlertmanagerChoiceResponse(
  server: SetupServer,
  response: GrafanaAlertingConfigurationStatusResponse
) {
  server.use(http.get('/api/v1/ngalert', () => HttpResponse.json(response)));
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
