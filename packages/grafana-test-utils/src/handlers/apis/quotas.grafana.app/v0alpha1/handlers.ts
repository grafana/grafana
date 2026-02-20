import { HttpResponse, http } from 'msw';

const getUsageHandler = () =>
  http.get('/apis/quotas.grafana.app/v0alpha1/namespaces/:namespace/usage', ({ request }) => {
    const url = new URL(request.url);
    const group = url.searchParams.get('group');
    const resource = url.searchParams.get('resource');

    return HttpResponse.json({
      apiVersion: 'quotas.grafana.app/v0alpha1',
      kind: 'GetUsageResponse',
      group,
      resource,
      namespace: 'default',
      usage: 100,
      limit: 1000,
    });
  });

export default [getUsageHandler()];
