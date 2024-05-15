import { HttpResponse, http } from 'msw';

import { mockFolder } from 'app/features/alerting/unified/mocks';

export const getFolderHandler = (response = mockFolder()) =>
  http.get(`/api/folders/:folderUid`, () => HttpResponse.json(response));

const handlers = [getFolderHandler()];

export default handlers;
