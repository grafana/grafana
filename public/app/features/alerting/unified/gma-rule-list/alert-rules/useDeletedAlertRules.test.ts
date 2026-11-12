import { HttpResponse, http } from 'msw';
import { act, getWrapper, renderHook, waitFor } from 'test/test-utils';

import { type AlertRule } from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';

import { setupMswServer } from '../../mockApi';
import { TRASH_RULES_URL, makeDeletedRule } from '../mocks/handlers';

import { useDeletedAlertRules } from './useDeletedAlertRules';

const server = setupMswServer();

function make(n: number): AlertRule[] {
  return Array.from({ length: n }, (_, i) =>
    makeDeletedRule({ metadata: { name: `rule-${i}`, annotations: { 'grafana.app/folder': 'f' } } })
  );
}

describe('useDeletedAlertRules', () => {
  it('returns first 40 items when server sends more (legacy mode)', async () => {
    server.use(
      http.get(TRASH_RULES_URL, () => HttpResponse.json({ kind: 'AlertRuleList', metadata: {}, items: make(90) }))
    );
    const { result } = renderHook(() => useDeletedAlertRules(), { wrapper: getWrapper({}) });
    await waitFor(() => expect(result.current.items).toHaveLength(40));
    expect(result.current.hasMore).toBe(true);
  });

  it('reveals next 40 from local buffer without a network request on loadMore', async () => {
    let requestCount = 0;
    server.use(
      http.get(TRASH_RULES_URL, () => {
        requestCount++;
        return HttpResponse.json({ kind: 'AlertRuleList', metadata: {}, items: make(90) });
      })
    );
    const { result } = renderHook(() => useDeletedAlertRules(), { wrapper: getWrapper({}) });
    await waitFor(() => expect(result.current.items).toHaveLength(40));

    await act(async () => {
      result.current.loadMore();
    });

    expect(result.current.items).toHaveLength(80);
    expect(requestCount).toBe(1);
  });

  it('returns isLoading true while request is in flight', () => {
    server.use(
      http.get(TRASH_RULES_URL, async () => {
        await new Promise(() => {});
        return HttpResponse.json({});
      })
    );
    const { result } = renderHook(() => useDeletedAlertRules(), { wrapper: getWrapper({}) });
    expect(result.current.isLoading).toBe(true);
  });

  it('returns error when request fails', async () => {
    server.use(http.get(TRASH_RULES_URL, () => HttpResponse.json({ message: 'boom' }, { status: 500 })));
    const { result } = renderHook(() => useDeletedAlertRules(), { wrapper: getWrapper({}) });
    await waitFor(() => expect(result.current.error).toBeTruthy());
  });

  it('shows empty list and hasMore false when no rules', async () => {
    server.use(http.get(TRASH_RULES_URL, () => HttpResponse.json({ kind: 'AlertRuleList', metadata: {}, items: [] })));
    const { result } = renderHook(() => useDeletedAlertRules(), { wrapper: getWrapper({}) });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.items).toHaveLength(0);
    expect(result.current.hasMore).toBe(false);
  });
});
