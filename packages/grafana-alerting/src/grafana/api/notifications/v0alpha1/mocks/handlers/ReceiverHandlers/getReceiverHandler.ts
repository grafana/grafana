import { HttpResponse, http } from 'msw';

import { getAPIBaseURLForMocks } from '../../../../../../mocks/util';
import { GetReceiverApiResponse } from '../../../../v0alpha1/notifications.api.gen';
import { GROUP, VERSION } from '../../../const';

export function getReceiverHandler(
  data: GetReceiverApiResponse | ((info: Parameters<Parameters<typeof http.get>[1]>[0]) => Response)
) {
  return http.get(getAPIBaseURLForMocks(GROUP, VERSION, '/receivers/:name'), function handler(info) {
    if (typeof data === 'function') {
      return data(info);
    }

    return HttpResponse.json(data);
  });
}
