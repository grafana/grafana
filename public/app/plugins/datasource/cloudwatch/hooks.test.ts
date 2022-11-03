import { renderHook } from '@testing-library/react-hooks';

import { setupMockedAPI } from './__mocks__/API';
import {
  accountIdVariable,
  dimensionVariable,
  metricVariable,
  namespaceVariable,
  regionVariable,
  setupMockedDataSource,
} from './__mocks__/CloudWatchDataSource';
import { useDimensionKeys, useIsMonitoringAccount, useMetrics } from './hooks';

const WAIT_OPTIONS = {
  timeout: 1000,
};

describe('hooks', () => {
  describe('useIsMonitoringAccount', () => {
    it('should interpolate variables before calling api', async () => {
      const { api } = setupMockedAPI({
        variables: [regionVariable],
      });
      const isMonitoringAccountMock = jest.fn().mockResolvedValue(true);
      api.isMonitoringAccount = isMonitoringAccountMock;

      const { waitForNextUpdate } = renderHook(() => useIsMonitoringAccount(api, `$${regionVariable.name}`));
      await waitForNextUpdate(WAIT_OPTIONS);
      expect(isMonitoringAccountMock).toHaveBeenCalledTimes(1);
      expect(isMonitoringAccountMock).toHaveBeenCalledWith(regionVariable.current.value);
    });
  });
  describe('useMetricNames', () => {
    it('should interpolate variables before calling api', async () => {
      const { datasource } = setupMockedDataSource({
        variables: [regionVariable, namespaceVariable, accountIdVariable],
      });
      const getMetricsMock = jest.fn().mockResolvedValue([]);
      datasource.api.getMetrics = getMetricsMock;

      const { waitForNextUpdate } = renderHook(() =>
        useMetrics(datasource, {
          namespace: `$${namespaceVariable.name}`,
          region: `$${regionVariable.name}`,
          accountId: `$${accountIdVariable.name}`,
        })
      );
      await waitForNextUpdate(WAIT_OPTIONS);
      expect(getMetricsMock).toHaveBeenCalledTimes(1);
      expect(getMetricsMock).toHaveBeenCalledWith({
        region: regionVariable.current.value,
        namespace: namespaceVariable.current.value,
        accountId: accountIdVariable.current.value,
      });
    });
  });

  describe('useDimensionKeys', () => {
    it('should interpolate variables before calling api', async () => {
      const { datasource } = setupMockedDataSource({
        mockGetVariableName: true,
        variables: [regionVariable, namespaceVariable, accountIdVariable, metricVariable, dimensionVariable],
      });
      const getDimensionKeysMock = jest.fn().mockResolvedValue([]);
      datasource.api.getDimensionKeys = getDimensionKeysMock;

      const { waitForNextUpdate } = renderHook(() =>
        useDimensionKeys(datasource, {
          namespace: `$${namespaceVariable.name}`,
          metricName: `$${metricVariable.name}`,
          region: `$${regionVariable.name}`,
          accountId: `$${accountIdVariable.name}`,
          dimensionFilters: {
            environment: `$${dimensionVariable.name}`,
          },
        })
      );
      await waitForNextUpdate(WAIT_OPTIONS);
      expect(getDimensionKeysMock).toHaveBeenCalledTimes(1);
      expect(getDimensionKeysMock).toHaveBeenCalledWith({
        region: regionVariable.current.value,
        namespace: namespaceVariable.current.value,
        metricName: metricVariable.current.value,
        accountId: accountIdVariable.current.value,
        dimensionFilters: {
          environment: [dimensionVariable.current.value],
        },
      });
    });
  });
});
