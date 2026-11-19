import { HttpResponse, http } from 'msw';
import { act, getWrapper, renderHook } from 'test/test-utils';

import { API_GROUP, API_VERSION, type RecordingRule } from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';

import { setupMswServer } from '../../mockApi';
import { makeDeletedRecordingRule } from '../mocks/handlers';

import { useRestoreRecordingRule } from './useRestoreRecordingRule';
import { sanitizeForRestore } from './useRestoreRule';

const server = setupMswServer();
const CREATE_URL = `/apis/${API_GROUP}/${API_VERSION}/namespaces/default/recordingrules`;

describe('useRestoreRecordingRule', () => {
  it('calls the create endpoint with the sanitized payload', async () => {
    let body: unknown;
    server.use(
      http.post(CREATE_URL, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({}, { status: 200 });
      })
    );

    const { result } = renderHook(() => useRestoreRecordingRule(), { wrapper: getWrapper({}) });
    const rule = makeDeletedRecordingRule();
    await act(async () => {
      await result.current.restore(rule);
    });

    expect((body as RecordingRule).metadata.deletionTimestamp).toBeUndefined();
    expect((body as RecordingRule).metadata.resourceVersion).toBeUndefined();
  });

  it('returns isConflict true on 409 response', async () => {
    server.use(http.post(CREATE_URL, () => HttpResponse.json({ message: 'conflict' }, { status: 409 })));

    const { result } = renderHook(() => useRestoreRecordingRule(), { wrapper: getWrapper({}) });
    let restoreResult: Awaited<ReturnType<typeof result.current.restore>>;
    await act(async () => {
      restoreResult = await result.current.restore(makeDeletedRecordingRule());
    });

    expect(restoreResult!.isConflict).toBe(true);
  });

  it('returns success false and isConflict false on non-409 error', async () => {
    server.use(http.post(CREATE_URL, () => HttpResponse.json({ message: 'boom' }, { status: 500 })));

    const { result } = renderHook(() => useRestoreRecordingRule(), { wrapper: getWrapper({}) });
    let restoreResult: Awaited<ReturnType<typeof result.current.restore>>;
    await act(async () => {
      restoreResult = await result.current.restore(makeDeletedRecordingRule());
    });

    expect(restoreResult!.success).toBe(false);
    expect(restoreResult!.isConflict).toBe(false);
  });
});

describe('sanitizeForRestore (recording rule)', () => {
  it('removes deletionTimestamp, resourceVersion, generation from a RecordingRule', () => {
    const rule = makeDeletedRecordingRule();
    rule.metadata.deletionTimestamp = '2026-11-10T10:00:00Z';
    rule.metadata.resourceVersion = 'abc123';
    rule.metadata.generation = -999;

    const result = sanitizeForRestore(rule);

    expect(result.metadata.deletionTimestamp).toBeUndefined();
    expect(result.metadata.resourceVersion).toBeUndefined();
    expect(result.metadata.generation).toBeUndefined();
  });

  it('strips grafana.com/group labels', () => {
    const rule = makeDeletedRecordingRule();
    rule.metadata.labels = { 'grafana.com/group': 'g1', 'grafana.com/group-index': '0', keep: 'me' };

    const result = sanitizeForRestore(rule);

    expect(result.metadata.labels?.['grafana.com/group']).toBeUndefined();
    expect(result.metadata.labels?.keep).toBe('me');
  });
});
