import { configureStore } from '@reduxjs/toolkit';
import { waitFor } from '@testing-library/react';
import { of } from 'rxjs';
import { createFetchResponse } from 'test/helpers/createFetchResponse';

import { GRAFANA_RULES_SOURCE_NAME } from '../utils/datasource';

import { PrometheusAPIFilters, alertRuleApi } from './alertRuleApi';
import { GRAFANA_RULER_CONFIG } from './featureDiscoveryApi';

const fetchMock = jest.fn();

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getBackendSrv: () => ({
    fetch: fetchMock,
  }),
}));

const createTestStore = () =>
  configureStore({
    reducer: {
      [alertRuleApi.reducerPath]: alertRuleApi.reducer,
    },
    middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(alertRuleApi.middleware),
  });

async function executePrometheusRuleNamespacesQuery(
  args: Partial<Parameters<typeof alertRuleApi.endpoints.prometheusRuleNamespaces.initiate>[0]> = {}
) {
  const store = createTestStore();
  await store.dispatch(
    alertRuleApi.endpoints.prometheusRuleNamespaces.initiate({
      ruleSourceName: GRAFANA_RULES_SOURCE_NAME,
      ...args,
    })
  );

  const [request] = fetchMock.mock.calls[fetchMock.mock.calls.length - 1] ?? [];
  return request;
}

describe('alertRuleApi', () => {
  describe('prometheusRuleNamespaces query parameters', () => {
    beforeEach(() => {
      fetchMock.mockReset();
      fetchMock.mockImplementation(() => of(createFetchResponse({ data: { groups: [] } })));
    });

    afterEach(() => {
      fetchMock.mockReset();
    });

    it('includes limit_alerts when value is zero', async () => {
      const request = await executePrometheusRuleNamespacesQuery({ limitAlerts: 0 });

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(request.params?.[PrometheusAPIFilters.LimitAlerts]).toBe('0');
    });

    it('omits limit_alerts when value is undefined', async () => {
      const request = await executePrometheusRuleNamespacesQuery();

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(request.params?.[PrometheusAPIFilters.LimitAlerts]).toBeUndefined();
    });

    it('includes limit_limit value', async () => {
      const request = await executePrometheusRuleNamespacesQuery({ limitAlerts: 25 });

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(request.params?.[PrometheusAPIFilters.LimitAlerts]).toBe('25');
    });
  });

  describe('upsertRuleGroupForNamespace cache invalidation', () => {
    beforeEach(() => {
      fetchMock.mockReset();
      fetchMock.mockImplementation(() => of(createFetchResponse({ data: { groups: [] } })));
    });

    afterEach(() => {
      fetchMock.mockReset();
    });

    // Combined rule views (e.g. the panel alerts list) read through prometheusRuleNamespaces, which
    // provides CombinedAlertRule. Saving a group must invalidate that tag or the list stays stale
    // until the next poll — the create-from-panel drawer bug in the flag-off path.
    it('refetches combined rule queries after a group is saved', async () => {
      const store = createTestStore();

      // Keep a combined-rule-backed query subscribed so invalidation can trigger a refetch.
      const querySubscription = store.dispatch(
        alertRuleApi.endpoints.prometheusRuleNamespaces.initiate({ ruleSourceName: GRAFANA_RULES_SOURCE_NAME })
      );
      await querySubscription;
      const callsAfterInitialQuery = fetchMock.mock.calls.length;

      await store.dispatch(
        alertRuleApi.endpoints.upsertRuleGroupForNamespace.initiate({
          rulerConfig: GRAFANA_RULER_CONFIG,
          namespace: 'test-folder',
          payload: { name: 'test-group', rules: [] },
        })
      );

      await waitFor(() => {
        expect(fetchMock.mock.calls.length).toBeGreaterThan(callsAfterInitialQuery);
      });

      querySubscription.unsubscribe();
    });
  });
});
