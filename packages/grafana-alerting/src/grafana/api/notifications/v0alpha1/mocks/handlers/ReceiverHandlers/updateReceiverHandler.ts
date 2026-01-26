import { HttpResponse, http } from 'msw';

import {
  API_GROUP,
  API_VERSION,
  UpdateReceiverApiResponse,
} from '@grafana/api-clients/rtkq/notifications.alerting/v0alpha1';

import { getAPIBaseURLForMocks } from '../../../../../../mocks/util';

export function updateReceiverHandler(
  data: UpdateReceiverApiResponse | ((info: Parameters<Parameters<typeof http.patch>[1]>[0]) => Response)
) {
  return http.patch(getAPIBaseURLForMocks(API_GROUP, API_VERSION, '/receivers/:name'), function handler(info) {
    if (typeof data === 'function') {
      return data(info);
    }

    return HttpResponse.json(data);
  });
}
