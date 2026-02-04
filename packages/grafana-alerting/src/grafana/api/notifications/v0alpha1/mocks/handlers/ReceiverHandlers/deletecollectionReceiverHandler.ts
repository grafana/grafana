import { HttpResponse, http } from 'msw';

import {
  API_GROUP,
  API_VERSION,
  DeletecollectionReceiverApiResponse,
} from '@grafana/api-clients/rtkq/notifications.alerting/v0alpha1';

import { getAPIBaseURLForMocks } from '../../../../../../mocks/util';

export function deletecollectionReceiverHandler(
  data: DeletecollectionReceiverApiResponse | ((info: Parameters<Parameters<typeof http.delete>[1]>[0]) => Response)
) {
  return http.delete(getAPIBaseURLForMocks(API_GROUP, API_VERSION, '/receivers'), function handler(info) {
    if (typeof data === 'function') {
      return data(info);
    }

    return HttpResponse.json(data);
  });
}
