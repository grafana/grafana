import { http, HttpResponse, RequestHandler } from 'msw';
import { setupServer } from 'msw/node';

import { AlertmanagersChoiceResponse } from 'app/features/alerting/unified/api/alertmanagerApi';
import { AlertmanagerChoice } from 'app/plugins/datasource/alertmanager/types';
import { AccessControlAction } from 'app/types';

import { alertmanagerChoiceHandler } from '../../../mocks/alertmanagerApi';

const alertmanagerChoiceMockedResponse: AlertmanagersChoiceResponse = {
  alertmanagersChoice: AlertmanagerChoice.Internal,
  numExternalAlertmanagers: 0,
};

const folderAccess = {
  [AccessControlAction.AlertingRuleCreate]: true,
  [AccessControlAction.AlertingRuleRead]: true,
  [AccessControlAction.AlertingRuleUpdate]: true,
  [AccessControlAction.AlertingRuleDelete]: true,
};

export function createMockGrafanaServer(...handlers: RequestHandler[]) {
  const folderHandler = mockFolderAccess(folderAccess);
  const amChoiceHandler = alertmanagerChoiceHandler(alertmanagerChoiceMockedResponse);

  return setupServer(folderHandler, amChoiceHandler, ...handlers);
}

// this endpoint is used to determine of we have edit / delete permissions for the Grafana managed alert rule
// a user must alsso have permissions for the folder (namespace) in which the alert rule is stored
function mockFolderAccess(accessControl: Partial<Record<AccessControlAction, boolean>>) {
  return http.get('/api/folders/:uid', ({ request }) => {
    const url = new URL(request.url);
    const uid = url.searchParams.get('uid');

    return HttpResponse.json({
      title: 'My Folder',
      uid,
      accessControl,
    });
  });
}
