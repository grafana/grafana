import { http, HttpResponse, RequestHandler } from 'msw';
import { setupServer } from 'msw/node';

import { GrafanaAlertingConfigurationStatusResponse } from 'app/features/alerting/unified/api/alertmanagerApi';
import { grafanaAlertingConfigurationStatusHandler } from 'app/features/alerting/unified/mocks/server/handlers/alertmanagers';
import { AlertmanagerChoice } from 'app/plugins/datasource/alertmanager/types';
import { AccessControlAction } from 'app/types';

const grafanaAlertingConfigurationMockedResponse: GrafanaAlertingConfigurationStatusResponse = {
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
  const amChoiceHandler = grafanaAlertingConfigurationStatusHandler(grafanaAlertingConfigurationMockedResponse);

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
