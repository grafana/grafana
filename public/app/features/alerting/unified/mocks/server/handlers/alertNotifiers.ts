import { HttpResponse, http } from 'msw';

import { grafanaAlertNotifiersMock } from 'app/features/alerting/unified/mockGrafanaNotifiers';

const getAlertNotifiers = () =>
  http.get('/api/alert-notifiers', () => {
    return HttpResponse.json(grafanaAlertNotifiersMock);
  });

const handlers = [getAlertNotifiers()];
export default handlers;
