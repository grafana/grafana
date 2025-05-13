import { http } from 'msw';

import { getAPIBaseURLForMocks } from '../../../../../mocks/util';
import { GROUP, VERSION } from '../../../const';
import { EnhancedListReceiverApiResponse } from '../../../types';

export function listReceiverHandler(
  data?: EnhancedListReceiverApiResponse | ((info: Parameters<Parameters<typeof http.get>[1]>[0]) => Response)
) {
  return http.get(getAPIBaseURLForMocks(GROUP, VERSION, '/receivers'), function handler(info) {
    if (typeof data === 'function') {
      return data(info);
    }

    return new Response(JSON.stringify(data), {
      headers: {
        'Content-Type': 'application/json',
      },
    });
  });
}
