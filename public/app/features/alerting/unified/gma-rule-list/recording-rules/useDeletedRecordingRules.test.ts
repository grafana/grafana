import { HttpResponse, http } from 'msw';
import { act, getWrapper, renderHook, waitFor } from 'test/test-utils';

import { type RecordingRule } from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';
import server from '@grafana/test-utils/server';

import { setupMswServer } from '../../mockApi';
import { TRASH_RECORDING_RULES_URL, makeDeletedRecordingRule, mockTrashRecordingRules } from '../mocks/handlers';

import { useDeletedRecordingRules } from './useDeletedRecordingRules';

setupMswServer();

function make(n: number): RecordingRule[] {
  return Array.from({ length: n }, (_, i) =>
    makeDeletedRecordingRule({ metadata: { name: `rule-${i}`, annotations: { 'grafana.app/folder': 'f' } } })
  );
}

describe('useDeletedRecordingRules', () => {
  it('returns first 40 items when server sends more (legacy mode)', async () => {
    mockTrashRecordingRules(make(90));
    const { result } = renderHook(() => useDeletedRecordingRules(), { wrapper: getWrapper({}) });
    await waitFor(() => expect(result.current.items).toHaveLength(40));
    expect(result.current.hasMore).toBe(true);
  });

  it('reveals next 40 from local buffer without a network request on loadMore', async () => {
    mockTrashRecordingRules(make(90));
    const { result } = renderHook(() => useDeletedRecordingRules(), { wrapper: getWrapper({}) });
    await waitFor(() => expect(result.current.items).toHaveLength(40));

    await act(async () => {
      result.current.loadMore();
    });

    expect(result.current.items).toHaveLength(80);
  });

  it('returns isLoading true while request is in flight', async () => {
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    server.use(
      http.get(TRASH_RECORDING_RULES_URL, async () => {
        await gate;
        return HttpResponse.json({ kind: 'RecordingRuleList', metadata: {}, items: [] });
      })
    );
    const { result } = renderHook(() => useDeletedRecordingRules(), { wrapper: getWrapper({}) });
    expect(result.current.isLoading).toBe(true);
    release();
  });

  it('returns error when request fails', async () => {
    server.use(http.get(TRASH_RECORDING_RULES_URL, () => HttpResponse.json({ message: 'boom' }, { status: 500 })));
    const { result } = renderHook(() => useDeletedRecordingRules(), { wrapper: getWrapper({}) });
    await waitFor(() => expect(result.current.error).toBeTruthy());
  });

  it('shows empty list and hasMore false when no rules', async () => {
    mockTrashRecordingRules([]);
    const { result } = renderHook(() => useDeletedRecordingRules(), { wrapper: getWrapper({}) });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.items).toHaveLength(0);
    expect(result.current.hasMore).toBe(false);
  });
});
