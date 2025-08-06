import { renderHook, waitFor } from '@testing-library/react';

import { config } from '@grafana/runtime';

import {
  useAccountOptions,
  useDimensionKeys,
  useIsMonitoringAccount,
  useMetrics,
  useEnsureVariableHasSingleSelection,
} from './hooks';
import {
  accountIdVariable,
  dimensionVariable,
  metricVariable,
  namespaceVariable,
  regionVariable,
  setupMockedDataSource,
} from './mocks/CloudWatchDataSource';
import { setupMockedResourcesAPI } from './mocks/ResourcesAPI';

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

      renderHook(() => useIsMonitoringAccount(api, `$${regionVariable.name}`));
      await waitFor(() => {
        expect(isMonitoringAccountMock).toHaveBeenCalledTimes(1);
        expect(isMonitoringAccountMock).toHaveBeenCalledWith(regionVariable.current.value);
      });
    });
  });
  describe('useMetricNames', () => {
    it('should interpolate variables before calling api', async () => {
      const { datasource } = setupMockedDataSource({
        variables: [regionVariable, namespaceVariable, accountIdVariable],
      });
      const getMetricsMock = jest.fn().mockResolvedValue([]);
      datasource.resources.getMetrics = getMetricsMock;

      renderHook(() =>
        useMetrics(datasource, {
          namespace: `$${namespaceVariable.name}`,
          region: `$${regionVariable.name}`,
          accountId: `$${accountIdVariable.name}`,
        })
      );
      await waitFor(() => {
        expect(getMetricsMock).toHaveBeenCalledTimes(1);
        expect(getMetricsMock).toHaveBeenCalledWith({
          region: regionVariable.current.value,
          namespace: namespaceVariable.current.value,
          accountId: accountIdVariable.current.value,
        });
      });
    });
  });

  describe('useDimensionKeys', () => {
    it('should interpolate variables before calling api', async () => {
      const { datasource } = setupMockedDataSource({
        variables: [regionVariable, namespaceVariable, accountIdVariable, metricVariable, dimensionVariable],
      });
      const getDimensionKeysMock = jest.fn().mockResolvedValue([]);
      datasource.resources.getDimensionKeys = getDimensionKeysMock;

      renderHook(() =>
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
      await waitFor(() => {
        expect(getDimensionKeysMock).toHaveBeenCalledTimes(1);
        expect(getDimensionKeysMock).toHaveBeenCalledWith(
          {
            region: regionVariable.current.value,
            namespace: namespaceVariable.current.value,
            metricName: metricVariable.current.value,
            accountId: accountIdVariable.current.value,
            dimensionFilters: {
              environment: [dimensionVariable.current.value],
            },
          },
          false
        );
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
      renderHook(() => useAccountOptions(api, `$${regionVariable.name}`));
      await waitFor(() => {
        expect(getAccountsMock).toHaveBeenCalledTimes(0);
      });
    });

    it('interpolates region variables before calling the api', async () => {
      config.featureToggles.cloudWatchCrossAccountQuerying = true;
      const { api } = setupMockedResourcesAPI({
        variables: [regionVariable],
      });
      const getAccountsMock = jest.fn().mockResolvedValue([{ id: '123', label: 'accountLabel' }]);
      api.getAccounts = getAccountsMock;
      renderHook(() => useAccountOptions(api, `$${regionVariable.name}`));
      await waitFor(() => {
        expect(getAccountsMock).toHaveBeenCalledTimes(1);
        expect(getAccountsMock).toHaveBeenCalledWith({ region: regionVariable.current.value });
      });
    });

    it('returns properly formatted account options, and template variables', async () => {
      config.featureToggles.cloudWatchCrossAccountQuerying = true;
      const { api } = setupMockedResourcesAPI({
        variables: [regionVariable],
      });
      const getAccountsMock = jest.fn().mockResolvedValue([{ id: '123', label: 'accountLabel' }]);
      api.getAccounts = getAccountsMock;
      const { result } = renderHook(() => useAccountOptions(api, `$${regionVariable.name}`));
      await waitFor(() => {
        expect(result.current.value).toEqual([
          { label: 'accountLabel', description: '123', value: '123' },
          { label: 'Template Variables', options: [{ label: '$region', value: '$region' }] },
        ]);
      });
    });
  });

  describe('useEnsureVariableHasSingleSelection', () => {
    it('should return an error if a variable has multiple options selected', () => {
      const { datasource } = setupMockedDataSource();
      datasource.resources.isVariableWithMultipleOptionsSelected = jest.fn().mockReturnValue(true);

      const variable = '$variable';
      const { result } = renderHook(() => useEnsureVariableHasSingleSelection(datasource, variable));
      expect(result.current).toEqual(
        `Template variables with multiple selected options are not supported for ${variable}`
      );
    });

    it('should not return an error if a variable is a multi-variable but does not have multiple options selected', () => {
      const { datasource } = setupMockedDataSource();
      datasource.resources.isVariableWithMultipleOptionsSelected = jest.fn().mockReturnValue(false);

      const variable = '$variable';
      const { result } = renderHook(() => useEnsureVariableHasSingleSelection(datasource, variable));
      expect(result.current).toEqual('');
    });

    it('should not return an error if a variable is not a multi-variable', () => {
      const { datasource } = setupMockedDataSource();
      datasource.resources.isMultiVariable = jest.fn().mockReturnValue(false);

      const variable = '$variable';
      const { result } = renderHook(() => useEnsureVariableHasSingleSelection(datasource, variable));
      expect(result.current).toEqual('');
    });
  });
});
