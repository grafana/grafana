import { HttpResponse, http } from 'msw';

import { mockFolder } from 'app/features/alerting/unified/mocks';

export const getFolderHandler = (response = mockFolder()) =>
  http.get<{ folderUid: string }>(`/api/folders/:folderUid`, ({ request }) => {
    const { accessControl, ...withoutAccessControl } = response;

    // Server only responds with ACL if query param is sent
    const accessControlQueryParam = new URL(request.url).searchParams.get('accesscontrol');
    if (!accessControlQueryParam) {
      return HttpResponse.json(withoutAccessControl);
    }

    return HttpResponse.json(response);
  });

const handlers = [getFolderHandler()];

export default handlers;
