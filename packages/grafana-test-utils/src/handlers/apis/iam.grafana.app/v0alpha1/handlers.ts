import { HttpResponse, http } from 'msw';

const getDisplayMapping = () =>
  http.get<{ namespace: string }>('/apis/iam.grafana.app/v0alpha1/namespaces/:namespace/display', ({ request }) => {
    const url = new URL(request.url);
    const keys = url.searchParams.getAll('key');

    // Turn query params such as `user:1` into mock mapping of `User 1` etc.
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
  });

export default [getDisplayMapping()];
