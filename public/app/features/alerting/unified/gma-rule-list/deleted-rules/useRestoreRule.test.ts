import { HttpResponse, http } from 'msw';
import { act, getWrapper, renderHook } from 'test/test-utils';

import { API_GROUP, API_VERSION, type AlertRule } from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';

import { setupMswServer } from '../../mockApi';
import { makeDeletedRule } from '../mocks/handlers';

import { sanitizeForRestore, useRestoreAlertRule } from './useRestoreRule';

const server = setupMswServer();
const CREATE_URL = `/apis/${API_GROUP}/${API_VERSION}/namespaces/default/alertrules`;

describe('sanitizeForRestore', () => {
  it('removes deletionTimestamp, resourceVersion, managedFields, finalizers and generation', () => {
    const rule = makeDeletedRule();
    rule.metadata.deletionTimestamp = '2026-11-10T10:00:00Z';
    rule.metadata.resourceVersion = 'abc123';
    // Unified storage sets generation to -999 (DeletedGeneration) for trash items;
    // the apiserver rejects creates with generation < 0.
    rule.metadata.generation = -999;

    const result = sanitizeForRestore(rule);

    expect(result.metadata.deletionTimestamp).toBeUndefined();
    expect(result.metadata.resourceVersion).toBeUndefined();
    expect(result.metadata.generation).toBeUndefined();
  });

  it('keeps annotations as-is (provenance and ownership left for the backend to handle)', () => {
    const rule = makeDeletedRule();
    rule.metadata.annotations = {
      'grafana.app/folder': 'folder-uid',
      'grafana.com/provenance': 'api',
      'grafana.app/managedBy': 'terraform',
    };

    const result = sanitizeForRestore(rule);

    expect(result.metadata.annotations?.['grafana.app/folder']).toBe('folder-uid');
    expect(result.metadata.annotations?.['grafana.com/provenance']).toBe('api');
    expect(result.metadata.annotations?.['grafana.app/managedBy']).toBe('terraform');
  });

  it('strips grafana.com/group labels that the group-free create API rejects', () => {
    const rule = makeDeletedRule();
    rule.metadata.labels = {
      'grafana.app/folder': 'folder-uid',
      'grafana.com/group': 'g1',
      'grafana.com/group-index': '0',
    };

    const result = sanitizeForRestore(rule);

    expect(result.metadata.labels?.['grafana.app/folder']).toBe('folder-uid');
    expect(result.metadata.labels?.['grafana.com/group']).toBeUndefined();
    expect(result.metadata.labels?.['grafana.com/group-index']).toBeUndefined();
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
