import { renderHook } from '@testing-library/react-hooks';

import createMockDatasource from '../../__mocks__/datasource';
import Datasource from '../../datasource';
import { AzureMetricQuery, AzureMonitorOption, AzureMonitorQuery, AzureQueryType } from '../../types';
import { DataHook } from '../MetricsQueryEditor/dataHooks';
import { useMetricNames, useMetricNamespaces } from './dataHooks';

const WAIT_OPTIONS = {
  timeout: 1000,
};

const opt = (text: string, value: string) => ({ text, value });

interface TestScenario {
  name: string;
  hook: DataHook;

  // For convenience, only need to define the azureMonitor part of the query for some tests
  emptyQueryPartial: AzureMetricQuery;
  customProperties: AzureMetricQuery;
  topLevelCustomProperties?: Partial<AzureMonitorQuery>;

  expectedCustomPropertyResults?: Array<AzureMonitorOption<string>>;
  expectedOptions: AzureMonitorOption[];
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

    datasource.azureMonitorDatasource.newGetMetricNames = jest
      .fn()
      .mockResolvedValue([opt('Percentage CPU', 'percentage-cpu'), opt('Free memory', 'free-memory')]);

    datasource.azureMonitorDatasource.newGetMetricNamespaces = jest
      .fn()
      .mockResolvedValue([opt('Compute Virtual Machine', 'azure/vmc'), opt('Database NS', 'azure/dbns')]);
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
});
