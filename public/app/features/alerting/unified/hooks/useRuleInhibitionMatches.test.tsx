import { renderHook, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { getWrapper } from 'test/test-utils';

import { setupMswServer } from 'app/features/alerting/unified/mockApi';
import { ALERTING_API_SERVER_BASE_URL, getK8sResponse } from 'app/features/alerting/unified/mocks/server/utils';

import { useRuleInhibitionMatches } from './useRuleInhibitionMatches';

const server = setupMswServer();

const wrapper = () => getWrapper({ renderWithRouter: true });

type InhibitionRuleItem = {
  name: string;
  source_matchers?: Array<{ label: string; type: '=' | '!=' | '=~' | '!~'; value: string }>;
  target_matchers?: Array<{ label: string; type: '=' | '!=' | '=~' | '!~'; value: string }>;
  equal?: string[];
};

function setInhibitionRulesResponse(items: InhibitionRuleItem[]) {
  const k8sItems = items.map((item) => ({
    apiVersion: 'notifications.alerting.grafana.app/v0alpha1',
    kind: 'InhibitionRule',
    metadata: { name: item.name, namespace: 'default' },
    spec: {
      source_matchers: item.source_matchers,
      target_matchers: item.target_matchers,
      equal: item.equal,
    },
  }));

  server.use(
    http.get(`${ALERTING_API_SERVER_BASE_URL}/namespaces/:namespace/inhibitionrules`, () =>
      HttpResponse.json(getK8sResponse('InhibitionRuleList', k8sItems))
    )
  );
}

describe('useRuleInhibitionMatches', () => {
  it('should return empty matches when there are no inhibition rules', async () => {
    const { result } = renderHook(() => useRuleInhibitionMatches({ severity: 'critical' }), { wrapper: wrapper() });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.matches).toHaveLength(0);
  });

  it('should return empty matches when labels do not match any inhibition rule', async () => {
    setInhibitionRulesResponse([
      {
        name: 'rule-1',
        source_matchers: [{ label: 'severity', type: '=', value: 'critical' }],
        target_matchers: [{ label: 'severity', type: '=', value: 'warning' }],
      },
    ]);

    const { result } = renderHook(() => useRuleInhibitionMatches({ severity: 'info' }), { wrapper: wrapper() });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.matches).toHaveLength(0);
  });

  it('should return a target match when labels match target_matchers', async () => {
    setInhibitionRulesResponse([
      {
        name: 'rule-1',
        source_matchers: [{ label: 'severity', type: '=', value: 'critical' }],
        target_matchers: [{ label: 'severity', type: '=', value: 'warning' }],
      },
    ]);

    const { result } = renderHook(() => useRuleInhibitionMatches({ severity: 'warning' }), { wrapper: wrapper() });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.matches).toHaveLength(1);
    expect(result.current.matches[0].role).toBe('target');
    expect(result.current.matches[0].rule.metadata.name).toBe('rule-1');
  });

  it('should return a source match when labels match source_matchers', async () => {
    setInhibitionRulesResponse([
      {
        name: 'rule-1',
        source_matchers: [{ label: 'severity', type: '=', value: 'critical' }],
        target_matchers: [{ label: 'severity', type: '=', value: 'warning' }],
      },
    ]);

    const { result } = renderHook(() => useRuleInhibitionMatches({ severity: 'critical' }), { wrapper: wrapper() });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.matches).toHaveLength(1);
    expect(result.current.matches[0].role).toBe('source');
  });

  it('should return role "both" when labels match both source and target matchers', async () => {
    setInhibitionRulesResponse([
      {
        name: 'rule-1',
        source_matchers: [{ label: 'team', type: '=', value: 'ops' }],
        target_matchers: [{ label: 'team', type: '=', value: 'ops' }],
      },
    ]);

    const { result } = renderHook(() => useRuleInhibitionMatches({ team: 'ops' }), { wrapper: wrapper() });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.matches).toHaveLength(1);
    expect(result.current.matches[0].role).toBe('both');
  });

  it('should handle multiple inhibition rules and return all matches', async () => {
    setInhibitionRulesResponse([
      {
        name: 'rule-1',
        target_matchers: [{ label: 'severity', type: '=', value: 'warning' }],
      },
      {
        name: 'rule-2',
        target_matchers: [{ label: 'env', type: '=', value: 'production' }],
      },
      {
        name: 'rule-3',
        target_matchers: [{ label: 'severity', type: '=', value: 'critical' }],
      },
    ]);

    const { result } = renderHook(() => useRuleInhibitionMatches({ severity: 'warning', env: 'production' }), {
      wrapper: wrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.matches).toHaveLength(2);
  });

  it('should handle regex matchers', async () => {
    setInhibitionRulesResponse([
      {
        name: 'rule-1',
        target_matchers: [{ label: 'severity', type: '=~', value: 'warn.*' }],
      },
    ]);

    const { result } = renderHook(() => useRuleInhibitionMatches({ severity: 'warning' }), { wrapper: wrapper() });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.matches).toHaveLength(1);
    expect(result.current.matches[0].role).toBe('target');
  });

  it('should handle negative regex matchers', async () => {
    setInhibitionRulesResponse([
      {
        name: 'rule-1',
        target_matchers: [{ label: 'severity', type: '!~', value: 'critical|warning' }],
      },
    ]);

    const { result } = renderHook(() => useRuleInhibitionMatches({ severity: 'info' }), { wrapper: wrapper() });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.matches).toHaveLength(1);
    expect(result.current.matches[0].role).toBe('target');
  });

  it('should return empty matches when the API call fails', async () => {
    server.use(
      http.get(`${ALERTING_API_SERVER_BASE_URL}/namespaces/:namespace/inhibitionrules`, () =>
        HttpResponse.json({ message: 'error' }, { status: 500 })
      )
    );

    const { result } = renderHook(() => useRuleInhibitionMatches({ severity: 'critical' }), { wrapper: wrapper() });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.matches).toHaveLength(0);
  });
});
