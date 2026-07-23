import { HttpResponse, http } from 'msw';

import { API_GROUP, API_VERSION } from '../../..';
import { getAPIBaseURLForMocks } from '../../../../../mocks/util';
import { type EnhancedListReceiverApiResponse } from '../../../types';

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
