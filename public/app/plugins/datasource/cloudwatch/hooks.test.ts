import { renderHook } from '@testing-library/react-hooks';

import { config } from '@grafana/runtime';

import {
  accountIdVariable,
  dimensionVariable,
  metricVariable,
  namespaceVariable,
  regionVariable,
  setupMockedDataSource,
} from './__mocks__/CloudWatchDataSource';
import { setupMockedResourcesAPI } from './__mocks__/ResourcesAPI';
import { useAccountOptions, useDimensionKeys, useIsMonitoringAccount, useMetrics } from './hooks';

const WAIT_OPTIONS = {
  timeout: 1000,
};

const originalFeatureToggleValue = config.featureToggles.cloudWatchCrossAccountQuerying;

describe('hooks', () => {
  afterEach(() => {
    config.featureToggles.cloudWatchCrossAccountQuerying = originalFeatureToggleValue;
  });
  describe('useIsMonitoringAccount', () => {
    it('should interpolate variables before calling api', async () => {
      config.featureToggles.cloudWatchCrossAccountQuerying = true;
      const { api } = setupMockedResourcesAPI({
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
      datasource.resources.getMetrics = getMetricsMock;

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
      datasource.resources.getDimensionKeys = getDimensionKeysMock;

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

  describe('useAccountOptions', () => {
    it('does not call the api if the feature toggle is off', async () => {
      config.featureToggles.cloudWatchCrossAccountQuerying = false;
      const { api } = setupMockedResourcesAPI({
        variables: [regionVariable],
      });
      const getAccountsMock = jest.fn().mockResolvedValue([{ id: '123', label: 'accountLabel' }]);
      api.getAccounts = getAccountsMock;
      const { waitForNextUpdate } = renderHook(() => useAccountOptions(api, `$${regionVariable.name}`));
      await waitForNextUpdate(WAIT_OPTIONS);
      expect(getAccountsMock).toHaveBeenCalledTimes(0);
    });

    it('interpolates region variables before calling the api', async () => {
      config.featureToggles.cloudWatchCrossAccountQuerying = true;
      const { api } = setupMockedResourcesAPI({
        variables: [regionVariable],
      });
      const getAccountsMock = jest.fn().mockResolvedValue([{ id: '123', label: 'accountLabel' }]);
      api.getAccounts = getAccountsMock;
      const { waitForNextUpdate } = renderHook(() => useAccountOptions(api, `$${regionVariable.name}`));
      await waitForNextUpdate(WAIT_OPTIONS);
      expect(getAccountsMock).toHaveBeenCalledTimes(1);
      expect(getAccountsMock).toHaveBeenCalledWith({ region: regionVariable.current.value });
    });

    it('returns properly formatted account options, and template variables', async () => {
      config.featureToggles.cloudWatchCrossAccountQuerying = true;
      const { api } = setupMockedResourcesAPI({
        variables: [regionVariable],
      });
      const getAccountsMock = jest.fn().mockResolvedValue([{ id: '123', label: 'accountLabel' }]);
      api.getAccounts = getAccountsMock;
      const { waitForNextUpdate, result } = renderHook(() => useAccountOptions(api, `$${regionVariable.name}`));
      await waitForNextUpdate(WAIT_OPTIONS);
      expect(result.current.value).toEqual([
        { label: 'accountLabel', description: '123', value: '123' },
        { label: 'Template Variables', options: [{ label: '$region', value: '$region' }] },
      ]);
    });
  });
});
