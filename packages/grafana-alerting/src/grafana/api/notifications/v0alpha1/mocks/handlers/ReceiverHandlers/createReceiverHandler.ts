import { HttpResponse, http } from 'msw';

import { getAPIBaseURLForMocks } from '../../../../../../mocks/util';
import { CreateReceiverApiResponse } from '../../../../v0alpha1/notifications.api.gen';
import { GROUP, VERSION } from '../../../const';

export function createReceiverHandler(
  data: CreateReceiverApiResponse | ((info: Parameters<Parameters<typeof http.post>[1]>[0]) => Response)
) {
  return http.post(getAPIBaseURLForMocks(GROUP, VERSION, '/receivers'), function handler(info) {
    if (typeof data === 'function') {
      return data(info);
    }

    return HttpResponse.json(data);
  });
}
