import { HttpResponse, http } from 'msw';

import { API_GROUP, API_VERSION } from '@grafana/api-clients/rtkq/notifications.alerting/v0alpha1';

import { getAPIBaseURLForMocks } from '../../../../../../mocks/util';
import { EnhancedListReceiverApiResponse } from '../../../types';

export function listReceiverHandler(
  data: EnhancedListReceiverApiResponse | ((info: Parameters<Parameters<typeof http.get>[1]>[0]) => Response)
) {
  return http.get(getAPIBaseURLForMocks(API_GROUP, API_VERSION, '/receivers'), function handler(info) {
    if (typeof data === 'function') {
      return data(info);
    }

    return HttpResponse.json(data);
  });
}
