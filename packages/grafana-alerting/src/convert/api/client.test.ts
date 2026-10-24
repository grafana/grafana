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

describe('convertAPI', () => {
  it('asks for JSON when reading rules, since Grafana answers in YAML otherwise', async () => {
    const requests = captureRequests('get', '/api/convert/prometheus/config/v1/rules/:namespace', {
      'my folder': [],
    });

    const result = await createStore()
      .dispatch(convertAPI.endpoints.getNamespace.initiate({ namespace: 'my folder', folderUid: 'parent' }))
      .unwrap();

    expect(result).toEqual({ 'my folder': [] });
    expect(new URL(requests[0].url).pathname).toBe('/api/convert/prometheus/config/v1/rules/my%20folder');
    expect(requests[0].headers.get('Accept')).toBe('application/json');
    expect(requests[0].headers.get('X-Grafana-Alerting-Folder-UID')).toBe('parent');
  });

  it('posts a rule group with the import options as headers', async () => {
    const requests = captureRequests('post', '/api/convert/prometheus/config/v1/rules/:namespace', accepted);
    const group = { name: 'node', interval: '1m', rules: [{ alert: 'NodeDown', expr: 'up == 0' }] };
    // Typed the way the README tells apps to name an endpoint's arguments.
    const args: typeof convertAPI.endpoints.postRuleGroup.Types.QueryArg = {
      namespace: 'integrations-node',
      payload: group,
      datasourceUid: 'mimir',
      notificationSettings: { type: 'NamedRoutingTree', routingTree: 'team-a' },
    };

    await createStore().dispatch(convertAPI.endpoints.postRuleGroup.initiate(args)).unwrap();

    expect(await requests[0].json()).toEqual(group);
    expect(requests[0].headers.get('X-Grafana-Alerting-Datasource-UID')).toBe('mimir');
    expect(requests[0].headers.get('X-Grafana-Alerting-Notification-Settings')).toBe('{"policy":"team-a"}');
  });

  it('posts an Alertmanager config under its identifier', async () => {
    const requests = captureRequests('post', '/api/convert/api/v1/alerts', accepted);
    const payload = { alertmanager_config: 'route:\n  receiver: default\n', template_files: {} };

    await createStore()
      .dispatch(
        convertAPI.endpoints.postAlertmanagerConfig.initiate({ payload, identifier: 'prom-prod', dryRun: true })
      )
      .unwrap();

    expect(await requests[0].json()).toEqual(payload);
    expect(requests[0].headers.get('X-Grafana-Alerting-Config-Identifier')).toBe('prom-prod');
    expect(requests[0].headers.get('X-Grafana-Alerting-Dry-Run')).toBe('true');
  });
});
