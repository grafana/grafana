import { HttpResponse, http } from 'msw';

import {
  API_GROUP,
  API_VERSION,
  ReplaceReceiverApiResponse,
} from '@grafana/api-clients/rtkq/notifications.alerting/v0alpha1';

import { getAPIBaseURLForMocks } from '../../../../../../mocks/util';

export function replaceReceiverHandler(
  data: ReplaceReceiverApiResponse | ((info: Parameters<Parameters<typeof http.put>[1]>[0]) => Response)
) {
  return http.put(getAPIBaseURLForMocks(API_GROUP, API_VERSION, '/receivers/:name'), function handler(info) {
    if (typeof data === 'function') {
      return data(info);
    }

    return HttpResponse.json(data);
  });
}
