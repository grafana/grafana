import { HttpResponse, http } from 'msw';
import { getWrapper, renderHook, waitFor } from 'test/test-utils';

import { generatedAPI as notificationsAPI } from '@grafana/api-clients/rtkq/notifications.alerting/v1beta1';
import { configureStore } from 'app/store/configureStore';

import { setupMswServer } from '../mockApi';
import { convertResponse } from '../mocks/convertApi';

import { alertmanagerApi } from './alertmanagerApi';
import { convertApi } from './convertToGMAApi';

const server = setupMswServer();
const CONVERT_URL = '/api/convert/api/v1/alerts';
const SAMPLE_YAML = ['route:', '  receiver: default', 'receivers:', '  - name: default', ''].join('\n');
// Genuinely invalid per js-yaml: bad indentation of a mapping entry.
const INVALID_YAML = ['route:', '  receiver: default', 'foo: bar: baz', ''].join('\n');

const wrapper = getWrapper({ renderWithRouter: true });

function yamlFile(content = SAMPLE_YAML, name = 'am.yaml') {
  return new File([content], name, { type: 'application/yaml' });
}

function countRequests() {
  let count = 0;
  server.use(
    http.post(CONVERT_URL, () => {
      count += 1;
      return HttpResponse.json(convertResponse());
    })
  );
  return () => count;
}

describe('validateAlertmanagerConfigImport', () => {
  it('resolves the config and returns a successful response', async () => {
    server.use(http.post(CONVERT_URL, () => HttpResponse.json(convertResponse())));
    // Built once, outside the render callback: `File`'s `lastModified` defaults to `Date.now()`
    // when omitted, so constructing a fresh File on every render would churn the signature-based
    // cache key each render and the query would never settle on one key long enough to resolve.
    const args = { source: 'yaml' as const, yamlFile: yamlFile(), configIdentifier: 'prod' };

    const { result } = renderHook(() => convertApi.useValidateAlertmanagerConfigImportQuery(args), { wrapper });

    await waitFor(() => expect(result.current.currentData?.status).toBe('success'), { timeout: 5000 });
  });

  it('sends the dry-run and force-replace headers', async () => {
    const headers: Headers[] = [];
    server.use(
      http.post(CONVERT_URL, ({ request }) => {
        headers.push(request.headers);
        return HttpResponse.json(convertResponse());
      })
    );
    const args = { source: 'yaml' as const, yamlFile: yamlFile(), configIdentifier: 'prod' };

    const { result } = renderHook(() => convertApi.useValidateAlertmanagerConfigImportQuery(args), { wrapper });

    await waitFor(() => expect(result.current.currentData).toBeDefined());
    expect(headers).toHaveLength(1);
    expect(headers[0].get('X-Grafana-Alerting-Dry-Run')).toBe('true');
    expect(headers[0].get('X-Grafana-Alerting-Config-Force-Replace')).toBe('true');
    expect(headers[0].get('X-Grafana-Alerting-Config-Identifier')).toBe('prod');
  });

  it('rejects invalid YAML locally without ever calling the backend', async () => {
    const getRequestCount = countRequests();
    const args = { source: 'yaml' as const, yamlFile: yamlFile(INVALID_YAML, 'broken.yaml'), configIdentifier: 'prod' };

    const { result } = renderHook(() => convertApi.useValidateAlertmanagerConfigImportQuery(args), { wrapper });

    await waitFor(() => expect(result.current.error).toBeDefined());
    expect(result.current.error).toMatchObject({ message: expect.stringMatching(/syntax error/i) });
    expect(getRequestCount()).toBe(0);
  });

  it('keeps two different signatures in independent cache entries', async () => {
    server.use(
      http.post(CONVERT_URL, async ({ request }) => {
        const body = await request.clone().json();
        // Echo the config content back so each response is distinguishable by its own request.
        return HttpResponse.json(convertResponse({ error: body.alertmanager_config }));
      })
    );

    const argsA = { source: 'yaml' as const, yamlFile: yamlFile(SAMPLE_YAML, 'a.yaml'), configIdentifier: 'prod' };
    const argsB = {
      source: 'yaml' as const,
      yamlFile: yamlFile(INVALID_YAML.replace('foo: bar: baz', 'foo: baz'), 'b.yaml'),
      configIdentifier: 'prod',
    };

    const { result: resultA } = renderHook(() => convertApi.useValidateAlertmanagerConfigImportQuery(argsA), {
      wrapper,
    });
    const { result: resultB } = renderHook(() => convertApi.useValidateAlertmanagerConfigImportQuery(argsB), {
      wrapper,
    });

    await waitFor(() => expect(resultA.current.currentData).toBeDefined());
    await waitFor(() => expect(resultB.current.currentData).toBeDefined());
    expect(resultA.current.currentData).not.toEqual(resultB.current.currentData);
  });

  // Regression target: revisiting an already-validated signature must not re-hit the backend.
  it('serves a cache hit for an unchanged signature instead of refetching', async () => {
    const getRequestCount = countRequests();
    const args = { source: 'yaml' as const, yamlFile: yamlFile(), configIdentifier: 'prod' };

    const { result, rerender } = renderHook(
      (queryArgs) => convertApi.useValidateAlertmanagerConfigImportQuery(queryArgs),
      { wrapper, initialProps: args }
    );

    await waitFor(() => expect(result.current.currentData).toBeDefined());
    expect(getRequestCount()).toBe(1);

    // Same File instance, same identifier — an unrelated re-render with unchanged args.
    rerender(args);

    expect(result.current.currentData).toBeDefined();
    expect(getRequestCount()).toBe(1);
  });
});

describe('refetches after Alertmanager config mutations', () => {
  type Store = ReturnType<typeof configureStore>;

  const K8S_URL = '/apis/notifications.alerting.grafana.app/v1beta1/namespaces/:namespace';
  const payload = { alertmanager_config: '{}', template_files: {} };
  const requests = { alertmanagerConfig: 0, receivers: 0, routingTrees: 0, templateGroups: 0, timeIntervals: 0 };
  const loadedOnce = { alertmanagerConfig: 1, receivers: 1, routingTrees: 1, templateGroups: 1, timeIntervals: 1 };
  const refetchedOnce = { alertmanagerConfig: 2, receivers: 2, routingTrees: 2, templateGroups: 2, timeIntervals: 2 };

  beforeEach(() => {
    Object.keys(requests).forEach((key) => (requests[key as keyof typeof requests] = 0));

    const k8sList = (key: keyof typeof requests) => () => {
      requests[key] += 1;
      return HttpResponse.json({ apiVersion: 'v1beta1', kind: 'List', metadata: {}, items: [] });
    };
    server.use(
      http.get('/api/alertmanager/grafana/config/api/v1/alerts', () => {
        requests.alertmanagerConfig += 1;
        return HttpResponse.json({ alertmanager_config: { route: { receiver: 'a' }, receivers: [{ name: 'a' }] } });
      }),
      http.get(`${K8S_URL}/receivers`, k8sList('receivers')),
      http.get(`${K8S_URL}/routingtrees`, k8sList('routingTrees')),
      http.get(`${K8S_URL}/templategroups`, k8sList('templateGroups')),
      http.get(`${K8S_URL}/timeintervals`, k8sList('timeIntervals')),
      http.post(CONVERT_URL, () => HttpResponse.json(convertResponse())),
      http.post(`${CONVERT_URL}/:identifier/promote`, () => HttpResponse.json(convertResponse())),
      http.delete(CONVERT_URL, () => HttpResponse.json(convertResponse()))
    );
  });

  // Subscribed the way the screens that show these resources are, so only an invalidation updates them.
  async function storeWithResourcesLoaded(): Promise<Store> {
    const store = configureStore();
    await Promise.all([
      store.dispatch(alertmanagerApi.endpoints.getAlertmanagerConfiguration.initiate('grafana')),
      store.dispatch(notificationsAPI.endpoints.listReceiver.initiate({})),
      store.dispatch(notificationsAPI.endpoints.listRoutingTree.initiate({})),
      store.dispatch(notificationsAPI.endpoints.listTemplateGroup.initiate({})),
      store.dispatch(notificationsAPI.endpoints.listTimeInterval.initiate({})),
    ]);
    expect(requests).toEqual(loadedOnce);
    return store;
  }

  // Lets a refetch that would have started do so, for the cases that expect none.
  const settle = () => new Promise((resolve) => setTimeout(resolve, 100));

  it.each<[string, (store: Store) => Promise<unknown>]>([
    [
      'a staged import',
      (store) =>
        store.dispatch(convertApi.endpoints.postAlertmanagerConfig.initiate({ payload, identifier: 'prod' })).unwrap(),
    ],
    [
      'an import that promotes',
      (store) =>
        store
          .dispatch(
            convertApi.endpoints.postAlertmanagerConfig.initiate({ payload, identifier: 'prod', promote: true })
          )
          .unwrap(),
    ],
    [
      'a promote',
      (store) =>
        store.dispatch(convertApi.endpoints.promoteAlertmanagerConfig.initiate({ identifier: 'prod' })).unwrap(),
    ],
    [
      'a delete',
      (store) =>
        store.dispatch(convertApi.endpoints.deleteAlertmanagerConfig.initiate({ identifier: 'prod' })).unwrap(),
    ],
  ])('refetches the Alertmanager config and the notification resource lists after %s', async (_name, mutate) => {
    const store = await storeWithResourcesLoaded();

    await mutate(store);

    await waitFor(() => expect(requests).toEqual(refetchedOnce));
  });

  it('refetches nothing after a dry run', async () => {
    const store = await storeWithResourcesLoaded();

    await store
      .dispatch(convertApi.endpoints.postAlertmanagerConfig.initiate({ payload, identifier: 'prod', dryRun: true }))
      .unwrap();
    await settle();

    expect(requests).toEqual(loadedOnce);
  });

  it('refetches nothing when the import fails', async () => {
    server.use(http.post(CONVERT_URL, () => HttpResponse.json({ message: 'boom' }, { status: 500 })));
    const store = await storeWithResourcesLoaded();

    await store.dispatch(convertApi.endpoints.postAlertmanagerConfig.initiate({ payload, identifier: 'prod' }));
    await settle();

    expect(requests).toEqual(loadedOnce);
  });
});
