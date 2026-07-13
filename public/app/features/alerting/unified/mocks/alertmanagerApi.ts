import { HttpResponse, http } from 'msw';
import { type SetupServer } from 'msw/node';

import {
  AlertmanagerChoice,
  type ExternalAlertmanagersStatusResponse,
} from '../../../../plugins/datasource/alertmanager/types';
import { type GrafanaAlertingConfigurationStatusResponse } from '../api/alertmanagerApi';

export const defaultGrafanaAlertingConfigurationStatusResponse: GrafanaAlertingConfigurationStatusResponse = {
  alertmanagersChoice: AlertmanagerChoice.Internal,
  numExternalAlertmanagers: 0,
};

export function mockAlertmanagersResponse(server: SetupServer, response: ExternalAlertmanagersStatusResponse) {
  server.use(http.get('/api/v1/ngalert/alertmanagers', () => HttpResponse.json(response)));
}
