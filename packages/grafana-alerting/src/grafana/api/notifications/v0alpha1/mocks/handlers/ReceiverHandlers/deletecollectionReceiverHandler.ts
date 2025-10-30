import { HttpResponse, http } from 'msw';

import { getAPIBaseURLForMocks } from '../../../../../../mocks/util';
import { DeletecollectionReceiverApiResponse } from '../../../../v0alpha1/notifications.api.gen';
import { GROUP, VERSION } from '../../../const';

export function deletecollectionReceiverHandler(
  data: DeletecollectionReceiverApiResponse | ((info: Parameters<Parameters<typeof http.delete>[1]>[0]) => Response)
) {
  return http.delete(getAPIBaseURLForMocks(GROUP, VERSION, '/receivers'), function handler(info) {
    if (typeof data === 'function') {
      return data(info);
    }

    return HttpResponse.json(data);
  });
}
