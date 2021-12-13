import { renderHook } from '@testing-library/react-hooks';

import {
  DataHook,
  updateSubscriptions,
  useAsyncState,
  useMetricNames,
  useMetricNamespaces,
  useResourceGroups,
  useResourceNames,
  useResourceTypes,
} from './dataHooks';
import { AzureMetricQuery, AzureMonitorOption, AzureQueryType } from '../../types';
import createMockDatasource from '../../__mocks__/datasource';
import { MockedObjectDeep } from 'ts-jest/dist/utils/testing';
import Datasource from '../../datasource';

interface WaitableMock extends jest.Mock<any, any> {
  waitToBeCalled(): Promise<unknown>;
}

const WAIT_OPTIONS = {
  timeout: 1000,
};

function createWaitableMock() {
  let resolve: Function;

  const mock = jest.fn() as WaitableMock;
  mock.mockImplementation(() => {
    resolve && resolve();
  });

  mock.waitToBeCalled = () => {
    return new Promise((_resolve) => (resolve = _resolve));
  };

  return mock;
}

const opt = (text: string, value: string) => ({ text, value });

describe('AzureMonitor: useAsyncState', () => {
  const MOCKED_RANDOM_VALUE = 0.42069;

  beforeEach(() => {
    jest.spyOn(global.Math, 'random').mockReturnValue(MOCKED_RANDOM_VALUE);
  });

  afterEach(() => {
    jest.spyOn(global.Math, 'random').mockRestore();
  });

  it('should return data from an async function', async () => {
    const apiCall = () => Promise.resolve(['a', 'b', 'c']);
    const setError = jest.fn();

    const { result, waitForNextUpdate } = renderHook(() => useAsyncState(apiCall, setError, []));
    await waitForNextUpdate();

    expect(result.current).toEqual(['a', 'b', 'c']);
  });

  it('should report errors through setError', async () => {
    const error = new Error();
    const apiCall = () => Promise.reject(error);
    const setError = createWaitableMock();

    const { result, waitForNextUpdate } = renderHook(() => useAsyncState(apiCall, setError, []));
    await Promise.race([waitForNextUpdate(), setError.waitToBeCalled()]);

    expect(result.current).toEqual([]);
    expect(setError).toHaveBeenCalledWith(MOCKED_RANDOM_VALUE, error);
  });

  it('should clear the error once the request is successful', async () => {
    const apiCall = () => Promise.resolve(['a', 'b', 'c']);
    const setError = createWaitableMock();

    const { waitForNextUpdate } = renderHook(() => useAsyncState(apiCall, setError, []));
    await Promise.race([waitForNextUpdate(), setError.waitToBeCalled()]);

    expect(setError).toHaveBeenCalledWith(MOCKED_RANDOM_VALUE, undefined);
  });
});

interface TestScenario {
  name: string;
  hook: DataHook;

  // For conviencence, only need to define the azureMonitor part of the query
  emptyQueryPartial: AzureMetricQuery;
  validQueryPartial: AzureMetricQuery;
  invalidQueryPartial: AzureMetricQuery;
  templateVariableQueryPartial: AzureMetricQuery;

  expectedClearedQueryPartial?: AzureMetricQuery;
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
      name: 'useResourceGroups',
      hook: useResourceGroups,
      emptyQueryPartial: {},
      validQueryPartial: {
        resourceGroup: 'web-app-development',
      },
      invalidQueryPartial: {
        resourceGroup: 'wrong-resource-group`',
      },
      templateVariableQueryPartial: {
        resourceGroup: '$rg',
      },
      expectedOptions: [
        {
          label: 'Web App - Production',
          value: 'web-app-production',
        },
        {
          label: 'Web App - Development',
          value: 'web-app-development',
        },
      ],
      expectedClearedQueryPartial: {
        resourceGroup: undefined,
      },
    },

    {
      name: 'useResourceTypes',
      hook: useResourceTypes,
      emptyQueryPartial: {
        resourceGroup: 'web-app-development',
      },
      validQueryPartial: {
        resourceGroup: 'web-app-development',
        metricDefinition: 'azure/vm',
      },
      invalidQueryPartial: {
        resourceGroup: 'web-app-development',
        metricDefinition: 'azure/invalid-resource-type',
      },
      templateVariableQueryPartial: {
        resourceGroup: 'web-app-development',
        metricDefinition: '$rt',
      },
      expectedOptions: [
        {
          label: 'Virtual Machine',
          value: 'azure/vm',
        },
        {
          label: 'Database',
          value: 'azure/db',
        },
      ],
      expectedClearedQueryPartial: {
        resourceGroup: 'web-app-development',
        metricDefinition: undefined,
      },
    },

    {
      name: 'useResourceNames',
      hook: useResourceNames,
      emptyQueryPartial: {
        resourceGroup: 'web-app-development',
        metricDefinition: 'azure/vm',
      },
      validQueryPartial: {
        resourceGroup: 'web-app-development',
        metricDefinition: 'azure/vm',
        resourceName: 'web-server',
      },
      invalidQueryPartial: {
        resourceGroup: 'web-app-development',
        metricDefinition: 'azure/vm',
        resourceName: 'resource-that-doesnt-exist',
      },
      templateVariableQueryPartial: {
        resourceGroup: 'web-app-development',
        metricDefinition: 'azure/vm',
        resourceName: '$variable',
      },
      expectedOptions: [
        {
          label: 'Web server',
          value: 'web-server',
        },
        {
          label: 'Job server',
          value: 'job-server',
        },
      ],
      expectedClearedQueryPartial: {
        resourceGroup: 'web-app-development',
        metricDefinition: 'azure/vm',
        resourceName: undefined,
      },
    },

    {
      name: 'useMetricNames',
      hook: useMetricNames,
      emptyQueryPartial: {
        resourceGroup: 'web-app-development',
        metricDefinition: 'azure/vm',
        resourceName: 'web-server',
        metricNamespace: 'azure/vm',
      },
      validQueryPartial: {
        resourceGroup: 'web-app-development',
        metricDefinition: 'azure/vm',
        resourceName: 'web-server',
        metricNamespace: 'azure/vm',
      },
      invalidQueryPartial: {
        resourceGroup: 'web-app-development',
        metricDefinition: 'azure/vm',
        resourceName: 'web-server',
        metricNamespace: 'azure/vm',
        metricName: 'invalid-metric',
      },
      templateVariableQueryPartial: {
        resourceGroup: 'web-app-development',
        metricDefinition: 'azure/vm',
        resourceName: 'web-server',
        metricNamespace: 'azure/vm',
        metricName: '$variable',
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
      expectedClearedQueryPartial: {
        resourceGroup: 'web-app-development',
        metricDefinition: 'azure/vm',
        resourceName: 'web-server',
        metricNamespace: 'azure/vm',
        metricName: undefined,
      },
    },

    {
      name: 'useMetricNamespaces',
      hook: useMetricNamespaces,
      emptyQueryPartial: {
        resourceGroup: 'web-app-development',
        metricDefinition: 'azure/vm',
        resourceName: 'web-server',
        metricNamespace: 'azure/vm',
      },
      validQueryPartial: {
        resourceGroup: 'web-app-development',
        metricDefinition: 'azure/vm',
        resourceName: 'web-server',
        metricNamespace: 'azure/vm',
      },
      invalidQueryPartial: {
        resourceGroup: 'web-app-development',
        metricDefinition: 'azure/vm',
        resourceName: 'web-server',
        metricNamespace: 'azure/vm',
        metricName: 'invalid-metric',
      },
      templateVariableQueryPartial: {
        resourceGroup: 'web-app-development',
        metricDefinition: 'azure/vm',
        resourceName: 'web-server',
        metricNamespace: 'azure/vm',
        metricName: '$variable',
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
      ],
    },
  ];

  let datasource: MockedObjectDeep<Datasource>;
  let onChange: jest.Mock<any, any>;
  let setError: jest.Mock<any, any>;

  beforeEach(() => {
    onChange = jest.fn();
    setError = jest.fn();

    datasource = createMockDatasource();
    datasource.getVariables = jest.fn().mockReturnValue(['$sub', '$rg', '$rt', '$variable']);

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

    datasource.getMetricNames = jest
      .fn()
      .mockResolvedValue([opt('Percentage CPU', 'percentage-cpu'), opt('Free memory', 'free-memory')]);

    datasource.getMetricNamespaces = jest
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

    it('does not call onChange when the property has not been set', async () => {
      const query = {
        ...bareQuery,
        azureMonitor: scenario.emptyQueryPartial,
      };
      const { waitForNextUpdate } = renderHook(() => scenario.hook(query, datasource, onChange, setError));
      await waitForNextUpdate(WAIT_OPTIONS);

      expect(onChange).not.toHaveBeenCalled();
    });

    it('does not clear the property when it is a valid option', async () => {
      const query = {
        ...bareQuery,
        azureMonitor: scenario.validQueryPartial,
      };
      const { waitForNextUpdate } = renderHook(() => scenario.hook(query, datasource, onChange, setError));
      await waitForNextUpdate(WAIT_OPTIONS);

      expect(onChange).not.toHaveBeenCalled();
    });

    it('does not clear the property when it is a template variable', async () => {
      const query = {
        ...bareQuery,
        azureMonitor: scenario.templateVariableQueryPartial,
      };
      const { waitForNextUpdate } = renderHook(() => scenario.hook(query, datasource, onChange, setError));
      await waitForNextUpdate(WAIT_OPTIONS);

      expect(onChange).not.toHaveBeenCalled();
    });

    it('clears the property when it is not a valid option', async () => {
      const query = {
        ...bareQuery,
        azureMonitor: scenario.invalidQueryPartial,
      };
      const { waitForNextUpdate } = renderHook(() => scenario.hook(query, datasource, onChange, setError));
      await waitForNextUpdate(WAIT_OPTIONS);

      if (scenario.expectedClearedQueryPartial) {
        expect(onChange).toHaveBeenCalledWith({
          ...query,
          azureMonitor: {
            ...scenario.expectedClearedQueryPartial,
            dimensionFilters: [],
            timeGrain: '',
          },
        });
      } else {
        expect(onChange).not.toHaveBeenCalled();
      }
    });
  });
});

describe('AzureMonitor: updateSubscriptions', () => {
  const bareQuery = {
    refId: 'A',
    queryType: AzureQueryType.AzureMonitor,
  };

  [
    {
      description: 'should not update with no subscriptions',
      query: bareQuery,
      subscriptionOptions: [],
    },
    {
      description: 'should not update with the subscription as an option',
      query: { ...bareQuery, subscription: 'foo' },
      subscriptionOptions: [{ label: 'foo', value: 'foo' }],
    },
    {
      description: 'should update with the first subscription',
      query: { ...bareQuery },
      subscriptionOptions: [{ label: 'foo', value: 'foo' }],
      onChangeArgs: {
        ...bareQuery,
        subscription: 'foo',
        azureMonitor: {
          dimensionFilters: [],
          timeGrain: '',
        },
      },
    },
    {
      description: 'should update with the default subscription if the current subsription does not exists',
      query: { ...bareQuery, subscription: 'bar' },
      subscriptionOptions: [{ label: 'foo', value: 'foo' }],
      onChangeArgs: {
        ...bareQuery,
        subscription: 'foo',
        azureMonitor: {
          dimensionFilters: [],
          timeGrain: '',
        },
      },
    },
    {
      description: 'should clean up if neither the default sub nor the current sub exists',
      query: { ...bareQuery, subscription: 'bar' },
      subscriptionOptions: [{ label: 'foo', value: 'foo' }],
      defaultSubscription: 'foobar',
      onChangeArgs: {
        ...bareQuery,
        subscription: '',
        azureMonitor: {
          dimensionFilters: [],
          timeGrain: '',
        },
      },
    },
  ].forEach((test) => {
    it(test.description, () => {
      const onChange = jest.fn();
      updateSubscriptions(test.query, test.subscriptionOptions, onChange, test.defaultSubscription);
      if (test.onChangeArgs) {
        expect(onChange).toHaveBeenCalledWith(test.onChangeArgs);
      } else {
        expect(onChange).not.toHaveBeenCalled();
      }
    });
  });
});
