import { renderHook, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { getWrapper } from 'test/test-utils';

import { setupMswServer } from 'app/features/alerting/unified/mockApi';
import { ALERTING_API_SERVER_BASE_URL, getK8sResponse } from 'app/features/alerting/unified/mocks/server/utils';
import { GRAFANA_RULES_SOURCE_NAME } from 'app/features/alerting/unified/utils/datasource';

import { useHasInhibitionRules } from './useHasInhibitionRules';

const server = setupMswServer();

const wrapper = () => getWrapper({ renderWithRouter: true });

function setInhibitionRulesResponse(items: Array<{ name: string; equal?: string[] }>) {
  const k8sItems = items.map((item) => ({
    apiVersion: 'notifications.alerting.grafana.app/v0alpha1',
    kind: 'InhibitionRule',
    metadata: { name: item.name, namespace: 'default' },
    spec: { equal: item.equal ?? ['alertname'] },
  }));

  server.use(
    http.get(`${ALERTING_API_SERVER_BASE_URL}/namespaces/:namespace/inhibitionrules`, () =>
      HttpResponse.json(getK8sResponse('InhibitionRuleList', k8sItems))
    )
  );
}

describe('useHasInhibitionRules', () => {
  it('should return false when no inhibition rules exist', async () => {
    const { result } = renderHook(() => useHasInhibitionRules(GRAFANA_RULES_SOURCE_NAME), { wrapper: wrapper() });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.hasInhibitionRules).toBe(false);
  });

  it('should return true when inhibition rules exist', async () => {
    setInhibitionRulesResponse([{ name: 'rule-1', equal: ['alertname'] }]);

    const { result } = renderHook(() => useHasInhibitionRules(GRAFANA_RULES_SOURCE_NAME), { wrapper: wrapper() });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.hasInhibitionRules).toBe(true);
  });

  it('should return isLoading true while loading', async () => {
    const { result } = renderHook(() => useHasInhibitionRules(GRAFANA_RULES_SOURCE_NAME), { wrapper: wrapper() });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
  });

  it('should return false when alertmanagerSourceName is undefined', async () => {
    const { result } = renderHook(() => useHasInhibitionRules(undefined), { wrapper: wrapper() });

    expect(result.current.hasInhibitionRules).toBe(false);
    expect(result.current.isLoading).toBe(false);
  });

  it('should return false for non-Grafana alertmanager sources', async () => {
    setInhibitionRulesResponse([{ name: 'rule-1' }]);

    const { result } = renderHook(() => useHasInhibitionRules('some-external-alertmanager'), { wrapper: wrapper() });

    expect(result.current.hasInhibitionRules).toBe(false);
    expect(result.current.isLoading).toBe(false);
  });

  it('should return false when the API call fails', async () => {
    server.use(
      http.get(`${ALERTING_API_SERVER_BASE_URL}/namespaces/:namespace/inhibitionrules`, () =>
        HttpResponse.json({ message: 'error' }, { status: 500 })
      )
    );

    const { result } = renderHook(() => useHasInhibitionRules(GRAFANA_RULES_SOURCE_NAME), { wrapper: wrapper() });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.hasInhibitionRules).toBe(false);
  });
});
