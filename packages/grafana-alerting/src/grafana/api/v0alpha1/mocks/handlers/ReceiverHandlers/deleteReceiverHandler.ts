import { http } from 'msw';

import { getAPIBaseURLForMocks } from '../../../../../mocks/util';
import { DeleteReceiverApiResponse } from '../../../api.gen';
import { GROUP, VERSION } from '../../../const';

export function deleteReceiverHandler(
  data?: DeleteReceiverApiResponse | ((info: Parameters<Parameters<typeof http.delete>[1]>[0]) => Response)
) {
  return http.delete(getAPIBaseURLForMocks(GROUP, VERSION, '/receivers/:name'), function handler(info) {
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
