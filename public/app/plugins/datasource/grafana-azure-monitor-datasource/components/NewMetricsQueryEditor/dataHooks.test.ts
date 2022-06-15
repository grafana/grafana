import { renderHook } from '@testing-library/react-hooks';

import createMockDatasource from '../../__mocks__/datasource';
import Datasource from '../../datasource';
import { AzureMetricQuery, AzureMonitorOption, AzureMonitorQuery, AzureQueryType } from '../../types';
import { DataHook, MetricMetadata, MetricsMetadataHook } from '../MetricsQueryEditor/dataHooks';

import { useMetricNames, useMetricNamespaces, useMetricMetadata } from './dataHooks';

const WAIT_OPTIONS = {
  timeout: 1000,
};

const opt = (text: string, value: string) => ({ text, value });

interface TestScenario {
  name: string;
  hook: DataHook | MetricsMetadataHook;

  // For convenience, only need to define the azureMonitor part of the query for some tests
  emptyQueryPartial: AzureMetricQuery;
  customProperties: AzureMetricQuery;
  topLevelCustomProperties?: Partial<AzureMonitorQuery>;

  expectedCustomPropertyResults?: Array<AzureMonitorOption<string>>;
  expectedOptions: AzureMonitorOption[] | MetricMetadata;
}

describe('AzureMonitor: metrics dataHooks', () => {
  const bareQuery = {
    refId: 'A',
    queryType: AzureQueryType.AzureMonitor,
    subscription: 'sub-abc-123',
  };

  const testTable: TestScenario[] = [
    {
      name: 'useMetricNames',
      hook: useMetricNames,
      emptyQueryPartial: {
        resourceUri:
          '/subscriptions/99999999-cccc-bbbb-aaaa-9106972f9572/resourceGroups/grafanastaging/providers/Microsoft.Compute/virtualMachines/grafana',
        metricNamespace: 'azure/vm',
      },
      customProperties: {
        resourceUri:
          '/subscriptions/99999999-cccc-bbbb-aaaa-9106972f9572/resourceGroups/grafanastaging/providers/Microsoft.Compute/virtualMachines/grafana',
        metricNamespace: 'azure/vm',
        metricName: 'metric-$ENVIRONMENT',
      },
      expectedOptions: [
        {
          label: 'Percentage CPU',
          value: 'percentage-cpu',
        },
        {
          label: 'Free memory',
          value: 'free-memory',
        },
      ],
      expectedCustomPropertyResults: [
        { label: 'Percentage CPU', value: 'percentage-cpu' },
        { label: 'Free memory', value: 'free-memory' },
        { label: 'metric-$ENVIRONMENT', value: 'metric-$ENVIRONMENT' },
      ],
    },
    {
      name: 'useMetricNamespaces',
      hook: useMetricNamespaces,
      emptyQueryPartial: {
        resourceUri:
          '/subscriptions/99999999-cccc-bbbb-aaaa-9106972f9572/resourceGroups/grafanastaging/providers/Microsoft.Compute/virtualMachines/grafana',
        metricNamespace: 'azure/vm',
      },
      customProperties: {
        resourceUri:
          '/subscriptions/99999999-cccc-bbbb-aaaa-9106972f9572/resourceGroups/grafanastaging/providers/Microsoft.Compute/virtualMachines/grafana',
        metricNamespace: 'azure/vm-$ENVIRONMENT',
        metricName: 'metric-name',
      },
      expectedOptions: [
        {
          label: 'Compute Virtual Machine',
          value: 'azure/vmc',
        },
        {
          label: 'Database NS',
          value: 'azure/dbns',
        },
        {
          label: 'azure/vm',
          value: 'azure/vm',
        },
      ],
      expectedCustomPropertyResults: [
        { label: 'Compute Virtual Machine', value: 'azure/vmc' },
        { label: 'Database NS', value: 'azure/dbns' },
        { label: 'azure/vm-$ENVIRONMENT', value: 'azure/vm-$ENVIRONMENT' },
      ],
    },
  ];

  let datasource: Datasource;
  let onChange: jest.Mock<any, any>;
  let setError: jest.Mock<any, any>;

  beforeEach(() => {
    onChange = jest.fn();
    setError = jest.fn();

    datasource = createMockDatasource();
    datasource.getVariables = jest.fn().mockReturnValue(['$sub', '$rg', '$rt', '$variable']);

    datasource.azureMonitorDatasource.getSubscriptions = jest
      .fn()
      .mockResolvedValue([opt('sub-abc-123', 'sub-abc-123')]);

    datasource.getResourceGroups = jest
      .fn()
      .mockResolvedValue([
        opt('Web App - Production', 'web-app-production'),
        opt('Web App - Development', 'web-app-development'),
      ]);

    datasource.getMetricDefinitions = jest
      .fn()
      .mockResolvedValue([opt('Virtual Machine', 'azure/vm'), opt('Database', 'azure/db')]);

    datasource.getResourceNames = jest
      .fn()
      .mockResolvedValue([opt('Web server', 'web-server'), opt('Job server', 'job-server')]);

    datasource.azureMonitorDatasource.getMetricNames = jest
      .fn()
      .mockResolvedValue([opt('Percentage CPU', 'percentage-cpu'), opt('Free memory', 'free-memory')]);

    datasource.azureMonitorDatasource.getMetricNamespaces = jest
      .fn()
      .mockResolvedValue([opt('Compute Virtual Machine', 'azure/vmc'), opt('Database NS', 'azure/dbns')]);

    datasource.azureMonitorDatasource.getMetricMetadata = jest.fn().mockResolvedValue({
      primaryAggType: 'Average',
      supportedAggTypes: ['Average'],
      supportedTimeGrains: [
        { label: 'Auto', value: 'auto' },
        { label: '1 minute', value: 'PT1M' },
        { label: '5 minutes', value: 'PT5M' },
        { label: '15 minutes', value: 'PT15M' },
        { label: '30 minutes', value: 'PT30M' },
        { label: '1 hour', value: 'PT1H' },
        { label: '6 hours', value: 'PT6H' },
        { label: '12 hours', value: 'PT12H' },
        { label: '1 day', value: 'P1D' },
      ],
      dimensions: [],
    });
  });

  describe.each(testTable)('scenario %#: $name', (scenario) => {
    it('returns values', async () => {
      const query = {
        ...bareQuery,
        azureMonitor: scenario.emptyQueryPartial,
      };
      const { result, waitForNextUpdate } = renderHook(() => scenario.hook(query, datasource, onChange, setError));
      await waitForNextUpdate(WAIT_OPTIONS);

      expect(result.current).toEqual(scenario.expectedOptions);
    });

    it('adds custom properties as a valid option', async () => {
      const query = {
        ...bareQuery,
        azureMonitor: scenario.customProperties,
        ...scenario.topLevelCustomProperties,
      };
      const { result, waitForNextUpdate } = renderHook(() => scenario.hook(query, datasource, onChange, setError));
      await waitForNextUpdate(WAIT_OPTIONS);

      expect(result.current).toEqual(scenario.expectedCustomPropertyResults);
    });
  });

  describe('useMetricsMetadataHook', () => {
    const metricsMetadataConfig = {
      name: 'useMetricMetadata',
      hook: useMetricMetadata,
      emptyQueryPartial: {
        resourceUri:
          '/subscriptions/99999999-cccc-bbbb-aaaa-9106972f9572/resourceGroups/grafanastaging/providers/Microsoft.Compute/virtualMachines/grafana',
        metricNamespace: 'azure/vm',
        metricName: 'Average CPU',
      },
      customProperties: {},
      expectedOptions: {
        aggOptions: [{ label: 'Average', value: 'Average' }],
        timeGrains: [
          { label: 'Auto', value: 'auto' },
          { label: '1 minute', value: 'PT1M' },
          { label: '5 minutes', value: 'PT5M' },
          { label: '15 minutes', value: 'PT15M' },
          { label: '30 minutes', value: 'PT30M' },
          { label: '1 hour', value: 'PT1H' },
          { label: '6 hours', value: 'PT6H' },
          { label: '12 hours', value: 'PT12H' },
          { label: '1 day', value: 'P1D' },
        ],
        dimensions: [],
        isLoading: false,
        supportedAggTypes: ['Average'],
        primaryAggType: 'Average',
      },
    };

    it('returns values', async () => {
      const query = {
        ...bareQuery,
        azureMonitor: metricsMetadataConfig.emptyQueryPartial,
      };
      const { result, waitForNextUpdate } = renderHook(() => metricsMetadataConfig.hook(query, datasource, onChange));
      await waitForNextUpdate(WAIT_OPTIONS);

      expect(result.current).toEqual(metricsMetadataConfig.expectedOptions);
      expect(onChange).toHaveBeenCalledWith({
        ...query,
        azureMonitor: {
          ...query.azureMonitor,
          aggregation: result.current.primaryAggType,
          timeGrain: 'auto',
          allowedTimeGrainsMs: [60_000, 300_000, 900_000, 1_800_000, 3_600_000, 21_600_000, 43_200_000, 86_400_000],
        },
      });
    });
  });
});
