import { HttpResponse, http } from 'msw';

import {
  API_GROUP,
  API_VERSION,
  DeleteReceiverApiResponse,
} from '@grafana/api-clients/rtkq/notifications.alerting/v0alpha1';

import { getAPIBaseURLForMocks } from '../../../../../../mocks/util';

export function deleteReceiverHandler(
  data: DeleteReceiverApiResponse | ((info: Parameters<Parameters<typeof http.delete>[1]>[0]) => Response)
) {
  return http.delete(getAPIBaseURLForMocks(API_GROUP, API_VERSION, '/receivers/:name'), function handler(info) {
    if (typeof data === 'function') {
      return data(info);
    }

    return HttpResponse.json(data);
  });
}
