import { HttpResponse, http } from 'msw';

import { getAPIBaseURLForMocks } from '../../../../../../mocks/util';
import { ReplaceReceiverApiResponse } from '../../../../v0alpha1/notifications.api.gen';
import { GROUP, VERSION } from '../../../const';

export function replaceReceiverHandler(
  data: ReplaceReceiverApiResponse | ((info: Parameters<Parameters<typeof http.put>[1]>[0]) => Response)
) {
  return http.put(getAPIBaseURLForMocks(GROUP, VERSION, '/receivers/:name'), function handler(info) {
    if (typeof data === 'function') {
      return data(info);
    }

    return HttpResponse.json(data);
  });
}
