import { HttpResponse, http } from 'msw';
import { act, getWrapper, renderHook } from 'test/test-utils';

import { API_GROUP, API_VERSION, type AlertRule } from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';

import { setupMswServer } from '../../mockApi';
import { makeDeletedRule } from '../mocks/handlers';

import { sanitizeForRestore, useRestoreAlertRule } from './useRestoreRule';

const server = setupMswServer();
const CREATE_URL = `/apis/${API_GROUP}/${API_VERSION}/namespaces/default/alertrules`;

describe('sanitizeForRestore', () => {
  it('removes deletion metadata, resourceVersion and status', () => {
    const rule = makeDeletedRule();
    rule.metadata.deletionTimestamp = '2026-11-10T10:00:00Z';
    rule.metadata.resourceVersion = 'abc123';
    (rule as AlertRule & { status?: unknown }).status = { health: 'ok' };

    const result = sanitizeForRestore(rule);

    expect(result.metadata.deletionTimestamp).toBeUndefined();
    expect(result.metadata.resourceVersion).toBeUndefined();
    expect((result as AlertRule & { status?: unknown }).status).toBeUndefined();
  });

  it('removes access annotations', () => {
    const rule = makeDeletedRule();
    rule.metadata.annotations = {
      'grafana.app/folder': 'folder-uid',
      'grafana.com/access/canWrite': 'true',
      'grafana.com/access/canDelete': 'true',
      'grafana.com/provenance': 'api',
      'grafana.app/managedBy': 'terraform',
      'grafana.com/group': 'old-group',
      'grafana.com/group-index': '0',
    };

    const result = sanitizeForRestore(rule);

    expect(result.metadata.annotations?.['grafana.app/folder']).toBe('folder-uid');
    expect(result.metadata.annotations?.['grafana.com/access/canWrite']).toBeUndefined();
    expect(result.metadata.annotations?.['grafana.com/provenance']).toBeUndefined();
    expect(result.metadata.annotations?.['grafana.app/managedBy']).toBeUndefined();
    expect(result.metadata.annotations?.['grafana.com/group']).toBeUndefined();
  });

  it('keeps metadata.name for UID preservation', () => {
    const rule = makeDeletedRule();
    rule.metadata.name = 'my-rule-uid';
    const result = sanitizeForRestore(rule);
    expect(result.metadata.name).toBe('my-rule-uid');
  });
});

describe('useRestoreAlertRule', () => {
  it('calls the create endpoint with the sanitized payload', async () => {
    let body: unknown;
    server.use(
      http.post(CREATE_URL, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({}, { status: 200 });
      })
    );

    const { result } = renderHook(() => useRestoreAlertRule(), { wrapper: getWrapper({}) });
    const rule = makeDeletedRule();
    await act(async () => {
      await result.current.restore(rule);
    });

    expect((body as AlertRule).metadata.deletionTimestamp).toBeUndefined();
    expect((body as AlertRule).metadata.resourceVersion).toBeUndefined();
  });

  it('returns isConflict true on 409 response', async () => {
    server.use(http.post(CREATE_URL, () => HttpResponse.json({ message: 'conflict' }, { status: 409 })));

    const { result } = renderHook(() => useRestoreAlertRule(), { wrapper: getWrapper({}) });
    let restoreResult: Awaited<ReturnType<typeof result.current.restore>>;
    await act(async () => {
      restoreResult = await result.current.restore(makeDeletedRule());
    });

    expect(restoreResult!.isConflict).toBe(true);
  });
});
