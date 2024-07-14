import { http, HttpResponse } from 'msw';
import { SetupServer } from 'msw/node';

import { grafanaAlertingConfigurationStatusHandler } from 'app/features/alerting/unified/mocks/server/handlers/alertmanagers';

import {
  AlertmanagerChoice,
  AlertManagerCortexConfig,
  ExternalAlertmanagersStatusResponse,
} from '../../../../plugins/datasource/alertmanager/types';
import { GrafanaAlertingConfigurationStatusResponse } from '../api/alertmanagerApi';
import { getDatasourceAPIUid } from '../utils/datasource';

export const defaultGrafanaAlertingConfigurationStatusResponse: GrafanaAlertingConfigurationStatusResponse = {
  alertmanagersChoice: AlertmanagerChoice.Internal,
  numExternalAlertmanagers: 0,
};

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
