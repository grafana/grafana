import { HttpResponse, http } from 'msw';

import {
  API_GROUP,
  API_VERSION,
  ListRoutingTreeApiResponse,
} from '@grafana/api-clients/rtkq/notifications.alerting/v0alpha1';

import { getAPIBaseURLForMocks } from '../../../../../../mocks/util';

export function listRoutingTreeHandler(
  data: ListRoutingTreeApiResponse | ((info: Parameters<Parameters<typeof http.get>[1]>[0]) => Response)
) {
  return http.get(getAPIBaseURLForMocks(API_GROUP, API_VERSION, '/routingtrees'), function handler(info) {
    if (typeof data === 'function') {
      return data(info);
    }

    return HttpResponse.json(data);
  });
}
