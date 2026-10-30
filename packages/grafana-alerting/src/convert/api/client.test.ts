import { configureStore } from '@reduxjs/toolkit';
import { HttpResponse, http } from 'msw';

import { MockBackendSrv } from '@grafana/api-clients';
import { setBackendSrv } from '@grafana/runtime';
import { setupMockServer } from '@grafana/test-utils/server';

import { convertAPI } from './client';

// @ts-ignore
setBackendSrv(new MockBackendSrv());

const server = setupMockServer();

function createStore() {
  return configureStore({
    reducer: { [convertAPI.reducerPath]: convertAPI.reducer },
    middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(convertAPI.middleware),
  });
}

// Serves `response` at `method path` and keeps the requests it received, to check what the client sent.
function captureRequests(method: 'get' | 'post' | 'delete', path: string, response: object) {
  const requests: Request[] = [];
  server.use(
    http[method](path, ({ request }) => {
      requests.push(request.clone());
      return HttpResponse.json(response);
    })
  );
  return requests;
}

const accepted = { status: 'success', errorType: '', error: '' };
const ALERTMANAGER_URL = '/api/convert/api/v1/alerts';
const alertmanagerPayload = { alertmanager_config: 'route:\n  receiver: default\n', template_files: {} };

const RULES_URL = '/api/convert/prometheus/config/v1/rules';
const ruleGroup = { name: 'node', interval: '1m', rules: [{ alert: 'NodeDown', expr: 'up == 0' }] };

type TestStore = ReturnType<typeof createStore>;

// Subscribes to the imported Alertmanager config, so a refetch after a mutation shows up as another read.
async function watchAlertmanagerConfig(store: TestStore) {
  const reads = captureRequests('get', ALERTMANAGER_URL, alertmanagerPayload);
  await store.dispatch(convertAPI.endpoints.getAlertmanagerConfig.initiate({ identifier: 'prom-prod' }));
  return reads;
}

// Same, for the imported rules.
async function watchRules(store: TestStore) {
  const reads = captureRequests('get', RULES_URL, {});
  await store.dispatch(convertAPI.endpoints.getRules.initiate());
  return reads;
}

// Waits for the refetches a mutation started, so "no refetch" can be asserted without a timer.
async function settle(store: TestStore) {
  await Promise.all(store.dispatch(convertAPI.util.getRunningQueriesThunk()));
}

describe('convertAPI', () => {
  it('asks for JSON when reading rules, since Grafana answers in YAML otherwise', async () => {
    const requests = captureRequests('get', `${RULES_URL}/:namespace`, {
      'my folder': [],
    });

    const result = await createStore()
      .dispatch(convertAPI.endpoints.getNamespace.initiate({ namespace: 'my folder', folderUid: 'parent' }))
      .unwrap();

    expect(result).toEqual({ 'my folder': [] });
    expect(new URL(requests[0].url).pathname).toBe(`${RULES_URL}/my%20folder`);
    expect(requests[0].headers.get('Accept')).toBe('application/json');
    expect(requests[0].headers.get('X-Grafana-Alerting-Folder-UID')).toBe('parent');
  });

  it('posts a rule group with the import options as headers', async () => {
    const requests = captureRequests('post', `${RULES_URL}/:namespace`, accepted);
    // Typed the way the README tells apps to name an endpoint's arguments.
    const args: typeof convertAPI.endpoints.postRuleGroup.Types.QueryArg = {
      namespace: 'integrations-node',
      payload: ruleGroup,
      datasourceUid: 'mimir',
      notificationSettings: { type: 'NamedRoutingTree', routingTree: 'team-a' },
    };

    await createStore().dispatch(convertAPI.endpoints.postRuleGroup.initiate(args)).unwrap();

    expect(await requests[0].json()).toEqual(ruleGroup);
    expect(requests[0].headers.get('X-Grafana-Alerting-Datasource-UID')).toBe('mimir');
    expect(requests[0].headers.get('X-Grafana-Alerting-Notification-Settings')).toBe('{"policy":"team-a"}');
  });

  it('posts an Alertmanager config under its identifier', async () => {
    const requests = captureRequests('post', ALERTMANAGER_URL, accepted);

    await createStore()
      .dispatch(
        convertAPI.endpoints.postAlertmanagerConfig.initiate({
          payload: alertmanagerPayload,
          identifier: 'prom-prod',
          dryRun: true,
        })
      )
      .unwrap();

    expect(await requests[0].json()).toEqual(alertmanagerPayload);
    expect(requests[0].headers.get('X-Grafana-Alerting-Config-Identifier')).toBe('prom-prod');
    expect(requests[0].headers.get('X-Grafana-Alerting-Dry-Run')).toBe('true');
  });

  it('refetches the imported Alertmanager config after an import', async () => {
    const store = createStore();
    const reads = await watchAlertmanagerConfig(store);
    captureRequests('post', ALERTMANAGER_URL, accepted);

    await store
      .dispatch(
        convertAPI.endpoints.postAlertmanagerConfig.initiate({ payload: alertmanagerPayload, identifier: 'prom-prod' })
      )
      .unwrap();
    await settle(store);

    expect(reads).toHaveLength(2);
  });

  it('does not refetch the imported Alertmanager config after a dry run', async () => {
    const store = createStore();
    const reads = await watchAlertmanagerConfig(store);
    captureRequests('post', ALERTMANAGER_URL, accepted);

    await store
      .dispatch(
        convertAPI.endpoints.postAlertmanagerConfig.initiate({
          payload: alertmanagerPayload,
          identifier: 'prom-prod',
          dryRun: true,
        })
      )
      .unwrap();
    await settle(store);

    expect(reads).toHaveLength(1);
  });

  it('promotes an Alertmanager config by its encoded identifier', async () => {
    const promotions = captureRequests('post', `${ALERTMANAGER_URL}/:identifier/promote`, accepted);

    await createStore()
      .dispatch(convertAPI.endpoints.promoteAlertmanagerConfig.initiate({ identifier: 'prom prod/1' }))
      .unwrap();

    expect(new URL(promotions[0].url).pathname).toBe(`${ALERTMANAGER_URL}/prom%20prod%2F1/promote`);
  });

  it('refetches the imported Alertmanager config after a promotion', async () => {
    const store = createStore();
    const reads = await watchAlertmanagerConfig(store);
    captureRequests('post', `${ALERTMANAGER_URL}/:identifier/promote`, accepted);

    await store.dispatch(convertAPI.endpoints.promoteAlertmanagerConfig.initiate({ identifier: 'prom-prod' })).unwrap();
    await settle(store);

    expect(reads).toHaveLength(2);
  });

  it('deletes an Alertmanager config by its identifier', async () => {
    const deletions = captureRequests('delete', ALERTMANAGER_URL, accepted);

    await createStore()
      .dispatch(convertAPI.endpoints.deleteAlertmanagerConfig.initiate({ identifier: 'prom-prod' }))
      .unwrap();

    expect(deletions[0].headers.get('X-Grafana-Alerting-Config-Identifier')).toBe('prom-prod');
  });

  it('refetches the imported Alertmanager config after a deletion', async () => {
    const store = createStore();
    const reads = await watchAlertmanagerConfig(store);
    captureRequests('delete', ALERTMANAGER_URL, accepted);

    await store.dispatch(convertAPI.endpoints.deleteAlertmanagerConfig.initiate({ identifier: 'prom-prod' })).unwrap();
    await settle(store);

    expect(reads).toHaveLength(2);
  });

  it('deletes a namespace in the given folder', async () => {
    const deletions = captureRequests('delete', `${RULES_URL}/:namespace`, accepted);

    await createStore()
      .dispatch(convertAPI.endpoints.deleteNamespace.initiate({ namespace: 'my folder', folderUid: 'parent' }))
      .unwrap();

    expect(new URL(deletions[0].url).pathname).toBe(`${RULES_URL}/my%20folder`);
    expect(deletions[0].headers.get('X-Grafana-Alerting-Folder-UID')).toBe('parent');
  });

  it('deletes a rule group in the given folder', async () => {
    const deletions = captureRequests('delete', `${RULES_URL}/:namespace/:group`, accepted);

    await createStore()
      .dispatch(
        convertAPI.endpoints.deleteRuleGroup.initiate({ namespace: 'my folder', group: 'node/1', folderUid: 'parent' })
      )
      .unwrap();

    expect(new URL(deletions[0].url).pathname).toBe(`${RULES_URL}/my%20folder/node%2F1`);
    expect(deletions[0].headers.get('X-Grafana-Alerting-Folder-UID')).toBe('parent');
  });

  it.each([
    {
      endpoint: 'postRuleGroups',
      method: 'post',
      mutate: (store: TestStore) => store.dispatch(convertAPI.endpoints.postRuleGroups.initiate({ payload: {} })),
    },
    {
      endpoint: 'postRuleGroup',
      method: 'post',
      mutate: (store: TestStore) =>
        store.dispatch(convertAPI.endpoints.postRuleGroup.initiate({ namespace: 'my folder', payload: ruleGroup })),
    },
    {
      endpoint: 'deleteNamespace',
      method: 'delete',
      mutate: (store: TestStore) =>
        store.dispatch(convertAPI.endpoints.deleteNamespace.initiate({ namespace: 'my folder' })),
    },
    {
      endpoint: 'deleteRuleGroup',
      method: 'delete',
      mutate: (store: TestStore) =>
        store.dispatch(convertAPI.endpoints.deleteRuleGroup.initiate({ namespace: 'my folder', group: 'node' })),
    },
  ] as const)('refetches the imported rules after $endpoint', async ({ method, mutate }) => {
    const store = createStore();
    const reads = await watchRules(store);
    // The root path takes the multi-namespace import, the wildcard the namespace and group paths.
    captureRequests(method, `${RULES_URL}/*`, accepted);
    captureRequests(method, RULES_URL, accepted);

    await mutate(store).unwrap();
    await settle(store);

    expect(reads).toHaveLength(2);
  });
});
