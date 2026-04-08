import { HttpResponse, http } from 'msw';
import { type SetupServer } from 'msw/node';

import { grafanaAlertingConfigurationStatusHandler } from 'app/features/alerting/unified/mocks/server/handlers/alertmanagers';

import {
  AlertmanagerChoice,
  type ExternalAlertmanagersStatusResponse,
} from '../../../../plugins/datasource/alertmanager/types';
import { type GrafanaAlertingConfigurationStatusResponse } from '../api/alertmanagerApi';

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
