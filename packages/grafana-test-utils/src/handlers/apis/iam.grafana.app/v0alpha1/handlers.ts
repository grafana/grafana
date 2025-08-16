import { HttpResponse, http } from 'msw';

//  /apis/iam.grafana.app/v0alpha1/namespaces/default/display?key=user%3A1&key=user%3A1
const getDisplayMapping = () =>
  http.get<{ folderUid: string; namespace: string }>(
    '/apis/iam.grafana.app/v0alpha1/namespaces/:namespace/display',
    ({ request }) => {
      const url = new URL(request.url);
      const keys = url.searchParams.getAll('key');
      const mockMappings = keys.map((key) => {
        const [_, id] = key.split(':');
        const displayName = `User ${id}`;
        return {
          identity: {
            type: 'user',
            name: `u00000000${id}`,
          },
          displayName,
          internalId: parseInt(id, 10),
        };
      });
      return HttpResponse.json({
        metadata: {},
        keys,
        display: mockMappings,
      });
    }
  );

export default [getDisplayMapping()];
