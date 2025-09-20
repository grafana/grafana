import { HttpResponse, http } from 'msw';

import { getAPIBaseURLForMocks } from '../../../../../mocks/util';
import { ListReceiverApiResponse } from '../../../api.gen';
import { GROUP, VERSION } from '../../../const';

export function listReceiverHandler(
  data: ListReceiverApiResponse | ((info: Parameters<Parameters<typeof http.get>[1]>[0]) => Response)
) {
  return http.get(getAPIBaseURLForMocks(GROUP, VERSION, '/receivers'), function handler(info) {
    if (typeof data === 'function') {
      return data(info);
    }

    return HttpResponse.json(data);
  });
}
