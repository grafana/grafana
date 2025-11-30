import { HttpResponse, http } from 'msw';

import {
  API_GROUP,
  API_VERSION,
  CreateReceiverApiResponse,
} from '@grafana/api-clients/rtkq/notifications.alerting/v0alpha1';

import { getAPIBaseURLForMocks } from '../../../../../../mocks/util';

export function createReceiverHandler(
  data: CreateReceiverApiResponse | ((info: Parameters<Parameters<typeof http.post>[1]>[0]) => Response)
) {
  return http.post(getAPIBaseURLForMocks(API_GROUP, API_VERSION, '/receivers'), function handler(info) {
    if (typeof data === 'function') {
      return data(info);
    }

    return HttpResponse.json(data);
  });
}
