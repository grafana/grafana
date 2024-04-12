import 'whatwg-fetch';
import { http, HttpResponse, RequestHandler } from 'msw';
import { setupServer } from 'msw/node';

import { AlertmanagersChoiceResponse } from 'app/features/alerting/unified/api/alertmanagerApi';
import { mockAlertmanagerChoiceResponseHandler } from 'app/features/alerting/unified/mocks/alertmanagerApi';
import { AlertmanagerChoice } from 'app/plugins/datasource/alertmanager/types';
import { AccessControlAction } from 'app/types';

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
  const amChoiceHandler = mockAlertmanagerChoiceResponseHandler(alertmanagerChoiceMockedResponse);
  const server = setupServer(folderHandler, amChoiceHandler, ...handlers);

  return server;
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
