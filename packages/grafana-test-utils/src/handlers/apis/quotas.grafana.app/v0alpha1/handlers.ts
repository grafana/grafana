import { HttpResponse, http } from 'msw';

export const USAGE_URL = '/apis/quotas.grafana.app/v0alpha1/namespaces/:namespace/usage';

const getUsageHandler = () =>
  http.get(USAGE_URL, ({ request }) => {
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
