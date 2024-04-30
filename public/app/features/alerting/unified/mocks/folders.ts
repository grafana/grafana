import { HttpResponse, http } from 'msw';

import { mockFolder } from 'app/features/alerting/unified/mocks';

export const folderHandler = (response = mockFolder()) =>
  http.get(`/api/folders/:folderUid`, () => HttpResponse.json(response));
