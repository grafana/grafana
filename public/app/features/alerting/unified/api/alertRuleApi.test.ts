import { configureStore } from '@reduxjs/toolkit';
import { of } from 'rxjs';
import { createFetchResponse } from 'test/helpers/createFetchResponse';

import { GRAFANA_RULES_SOURCE_NAME } from '../utils/datasource';

import { PrometheusAPIFilters, alertRuleApi } from './alertRuleApi';

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
});
