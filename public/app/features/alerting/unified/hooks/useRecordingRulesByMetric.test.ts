import { renderHook, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import React from 'react';
import { Provider } from 'react-redux';

import { configureStore } from 'app/store/configureStore';

import { setupMswServer } from '../mockApi';

import { useRecordingRulesByMetric } from './useRecordingRulesByMetric';

const server = setupMswServer();

function getWrapper() {
  const store = configureStore();
  return ({ children }: React.PropsWithChildren<{}>) => React.createElement(Provider, { store }, children);
}

describe('useRecordingRulesByMetric', () => {
  it('returns empty map when no recording rules exist', async () => {
    server.use(
      http.get('/apis/rules.alerting.grafana.app/v0alpha1/namespaces/default/recordingrules', () =>
        HttpResponse.json({ items: [], metadata: {}, apiVersion: 'v1', kind: 'RecordingRuleList' })
      )
    );

    const { result } = renderHook(() => useRecordingRulesByMetric(), { wrapper: getWrapper() });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.byDatasourceAndMetric.size).toBe(0);
    expect(result.current.error).toBeUndefined();
  });

  it('indexes recording rules by datasource UID and metric name', async () => {
    server.use(
      http.get('/apis/rules.alerting.grafana.app/v0alpha1/namespaces/default/recordingrules', () =>
        HttpResponse.json({
          items: [
            {
              apiVersion: 'rules.alerting.grafana.app/v0alpha1',
              kind: 'RecordingRule',
              metadata: { name: 'rule-uid-1' },
              spec: {
                title: 'CPU Usage Rule',
                metric: 'cpu_usage',
                targetDatasourceUID: 'ds-prom-1',
                expressions: {},
                trigger: {},
              },
            },
            {
              apiVersion: 'rules.alerting.grafana.app/v0alpha1',
              kind: 'RecordingRule',
              metadata: { name: 'rule-uid-2' },
              spec: {
                title: 'Memory Usage Rule',
                metric: 'memory_usage',
                targetDatasourceUID: 'ds-prom-1',
                expressions: {},
                trigger: {},
              },
            },
          ],
          metadata: {},
          apiVersion: 'v1',
          kind: 'RecordingRuleList',
        })
      )
    );

    const { result } = renderHook(() => useRecordingRulesByMetric(), { wrapper: getWrapper() });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.byDatasourceAndMetric.size).toBe(2);
    expect(result.current.byDatasourceAndMetric.get('ds-prom-1::cpu_usage')).toMatchObject({
      uid: 'rule-uid-1',
      name: 'CPU Usage Rule',
      metric: 'cpu_usage',
    });
    expect(result.current.byDatasourceAndMetric.get('ds-prom-1::memory_usage')).toMatchObject({
      uid: 'rule-uid-2',
      name: 'Memory Usage Rule',
      metric: 'memory_usage',
    });
  });

  it('handles duplicate metric names across different datasources', async () => {
    server.use(
      http.get('/apis/rules.alerting.grafana.app/v0alpha1/namespaces/default/recordingrules', () =>
        HttpResponse.json({
          items: [
            {
              metadata: { name: 'rule-a' },
              spec: { title: 'Rule A', metric: 'cpu_usage', targetDatasourceUID: 'ds-1', expressions: {}, trigger: {} },
            },
            {
              metadata: { name: 'rule-b' },
              spec: { title: 'Rule B', metric: 'cpu_usage', targetDatasourceUID: 'ds-2', expressions: {}, trigger: {} },
            },
          ],
          metadata: {},
        })
      )
    );

    const { result } = renderHook(() => useRecordingRulesByMetric(), { wrapper: getWrapper() });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.byDatasourceAndMetric.size).toBe(2);
    expect(result.current.byDatasourceAndMetric.get('ds-1::cpu_usage')?.uid).toBe('rule-a');
    expect(result.current.byDatasourceAndMetric.get('ds-2::cpu_usage')?.uid).toBe('rule-b');
  });

  it('returns loading state while fetching', () => {
    const { result } = renderHook(() => useRecordingRulesByMetric(), { wrapper: getWrapper() });
    expect(result.current.isLoading).toBe(true);
  });
});
