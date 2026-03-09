import { HttpResponse, http } from 'msw';

import { CreateNotificationqueryResponse } from '@grafana/api-clients/rtkq/historian.alerting/v0alpha1';

/**
 * Default handler for notification history API
 * Returns empty notification history by default
 */
const notificationHistoryHandlers = [
  http.post('/apis/historian.alerting.grafana.app/v0alpha1/namespaces/default/notification/query', () => {
    const response: CreateNotificationqueryResponse = {
      entries: [],
      counts: [],
    };

    return HttpResponse.json(response);
  }),
];

export default notificationHistoryHandlers;
