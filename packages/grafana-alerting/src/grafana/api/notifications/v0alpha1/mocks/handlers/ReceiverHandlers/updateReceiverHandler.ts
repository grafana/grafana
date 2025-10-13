import { HttpResponse, http } from 'msw';

import { getAPIBaseURLForMocks } from '../../../../../../mocks/util';
import { UpdateReceiverApiResponse } from '../../../../v0alpha1/notifications.api.gen';
import { GROUP, VERSION } from '../../../const';

export function updateReceiverHandler(
  data: UpdateReceiverApiResponse | ((info: Parameters<Parameters<typeof http.patch>[1]>[0]) => Response)
) {
  return http.patch(getAPIBaseURLForMocks(GROUP, VERSION, '/receivers/:name'), function handler(info) {
    if (typeof data === 'function') {
      return data(info);
    }

    return HttpResponse.json(data);
  });
}
