import { dateTime, TimeRange, VariableRefresh } from '@grafana/data';
import { config, DataSourceSrv } from '@grafana/runtime';
import * as runtime from '@grafana/runtime';

import { reduxTester } from '../../../../test/core/redux/reduxTester';
import { silenceConsoleOutput } from '../../../../test/core/utils/silenceConsoleOutput';
import { appEvents } from '../../../core/core';
import { notifyApp } from '../../../core/reducers/appNotification';
import { DashboardState } from '../../../types';
import { DashboardModel } from '../../dashboard/state/DashboardModel';
import { createDashboardModelFixture } from '../../dashboard/state/__fixtures__/dashboardFixtures';
import { TemplateSrv } from '../../templating/template_srv';
import { variableAdapters } from '../adapters';
import { createConstantVariableAdapter } from '../constant/adapter';
import { createDataSourceVariableAdapter } from '../datasource/adapter';
import { createIntervalVariableAdapter } from '../interval/adapter';
import { createIntervalOptions } from '../interval/reducer';
import { createQueryVariableAdapter } from '../query/adapter';
import { constantBuilder, intervalBuilder, queryBuilder, datasourceBuilder } from '../shared/testing/builders';
import { toKeyedVariableIdentifier, toVariablePayload } from '../utils';

import { onTimeRangeUpdated, OnTimeRangeUpdatedDependencies, setOptionAsCurrent } from './actions';
import * as actions from './actions';
import { getPreloadedState, getRootReducer, RootReducerType } from './helpers';
import { toKeyedAction } from './keyedVariablesReducer';
import {
  setCurrentVariableValue,
  variableStateCompleted,
  variableStateFailed,
  variableStateFetching,
} from './sharedReducer';
import { variablesInitTransaction } from './transactionReducer';

variableAdapters.setInit(() => [
  createIntervalVariableAdapter(),
  createConstantVariableAdapter(),
  createQueryVariableAdapter(),
  createDataSourceVariableAdapter(),
]);

const metricFindQuery = jest
  .fn()
  .mockResolvedValueOnce([{ text: 'responses' }, { text: 'timers' }])
  .mockResolvedValue([{ text: '200' }, { text: '500' }]);
const getMetricSources = jest.fn().mockReturnValue([]);
const getDatasource = jest.fn().mockResolvedValue({ metricFindQuery });

jest.mock('app/features/dashboard/services/TimeSrv', () => ({
  getTimeSrv: () => ({
    timeRange: jest.fn().mockReturnValue(undefined),
  }),
}));

runtime.setDataSourceSrv({
  get: getDatasource,
  getList: getMetricSources,
} as unknown as DataSourceSrv);

const getTestContext = (dashboard: DashboardModel) => {
  jest.clearAllMocks();

  const key = 'key';
  const interval = intervalBuilder()
    .withId('interval-0')
    .withRootStateKey(key)
    .withName('interval-0')
    .withOptions('1m', '10m', '30m', '1h', '6h', '12h', '1d', '7d', '14d', '30d')
    .withCurrent('1m')
    .withRefresh(VariableRefresh.onTimeRangeChanged)
    .build();

  const constant = constantBuilder()
    .withId('constant-1')
    .withRootStateKey(key)
    .withName('constant-1')
    .withOptions('a constant')
    .withCurrent('a constant')
    .build();

  const range: TimeRange = {
    from: dateTime(new Date().getTime()).subtract(1, 'minutes'),
    to: dateTime(new Date().getTime()),
    raw: {
      from: 'now-1m',
      to: 'now',
    },
  };
  const updateTimeRangeMock = jest.fn();
  const templateSrvMock = { updateTimeRange: updateTimeRangeMock } as unknown as TemplateSrv;
  const dependencies: OnTimeRangeUpdatedDependencies = { templateSrv: templateSrvMock, events: appEvents };
  const templateVariableValueUpdatedMock = jest.fn();
  const startRefreshMock = jest.fn();
  dashboard.templateVariableValueUpdated = templateVariableValueUpdatedMock;
  dashboard.startRefresh = startRefreshMock;
  const dashboardState = {
    getModel: () => dashboard,
  } as unknown as DashboardState;
  const adapterInterval = variableAdapters.get('interval');
  const adapterQuery = variableAdapters.get('query');
  const templatingState = {
    variables: {
      'interval-0': { ...interval },
      'constant-1': { ...constant },
    },
  };
  const preloadedState = {
    dashboard: dashboardState,
    ...getPreloadedState(key, templatingState),
  } as unknown as RootReducerType;

  return {
    key,
    interval,
    range,
    dependencies,
    adapterInterval,
    adapterQuery,
    preloadedState,
    updateTimeRangeMock,
    templateVariableValueUpdatedMock,
    startRefreshMock,
  };
};

const getTestContextVariables = (dashboard: DashboardModel, customeVariables?: object) => {
  jest.clearAllMocks();

  const key = 'key';
  const interval = intervalBuilder()
    .withId('interval-0')
    .withRootStateKey(key)
    .withName('interval-0')
    .withOptions('1m', '10m', '30m', '1h', '6h', '12h', '1d', '7d', '14d', '30d')
    .withCurrent('1m')
    .build();

  const constant = constantBuilder()
    .withId('constant-1')
    .withRootStateKey(key)
    .withName('constant-1')
    .withOptions('a constant')
    .withCurrent('a constant')
    .build();

  const queryA = queryBuilder()
    .withId('a')
    .withRootStateKey(key)
    .withName('a')
    .withQuery('query')
    .withRefresh(VariableRefresh.onTimeRangeChanged)
    .build();

  const queryB = queryBuilder()
    .withId('b')
    .withRootStateKey(key)
    .withName('b')
    .withQuery('$a')
    .withRefresh(VariableRefresh.onTimeRangeChanged)
    .build();

  const queryC = queryBuilder()
    .withId('c')
    .withRootStateKey(key)
    .withName('c')
    .withQuery('$a')
    .withRefresh(VariableRefresh.onTimeRangeChanged)
    .build();

  const varQueryWithNoDependentNodes = queryBuilder()
    .withId('d')
    .withRootStateKey(key)
    .withName('queryDNoDependentNodes')
    .withQuery('test query')
    .withRefresh(VariableRefresh.onTimeRangeChanged)
    .build();

  const range: TimeRange = {
    from: dateTime(new Date().getTime()).subtract(1, 'minutes'),
    to: dateTime(new Date().getTime()),
    raw: {
      from: 'now-1m',
      to: 'now',
    },
  };
  const updateTimeRangeMock = jest.fn();
  const templateSrvMock = { updateTimeRange: updateTimeRangeMock } as unknown as TemplateSrv;
  const dependencies: OnTimeRangeUpdatedDependencies = { templateSrv: templateSrvMock, events: appEvents };
  const templateVariableValueUpdatedMock = jest.fn();
  const startRefreshMock = jest.fn();
  dashboard.templateVariableValueUpdated = templateVariableValueUpdatedMock;
  dashboard.startRefresh = startRefreshMock;
  const dashboardState = {
    getModel: () => dashboard,
  } as unknown as DashboardState;
  const adapterInterval = variableAdapters.get('interval');
  const adapterQuery = variableAdapters.get('query');
  const templatingState = {
    variables: {
      'interval-0': { ...interval },
      'constant-1': { ...constant },
      a: { ...queryA },
      b: { ...queryB },
      c: { ...queryC },
      d: { ...varQueryWithNoDependentNodes },
      ...customeVariables,
    },
  };
  const preloadedState = {
    dashboard: dashboardState,
    ...getPreloadedState(key, templatingState),
  } as unknown as RootReducerType;

  return {
    key,
    interval,
    range,
    dependencies,
    adapterInterval,
    adapterQuery,
    preloadedState,
    updateTimeRangeMock,
    templateVariableValueUpdatedMock,
    startRefreshMock,
  };
};

describe('when onTimeRangeUpdated is dispatched', () => {
  describe('and options are changed by update', () => {
    it('then correct actions are dispatched and correct dependencies are called', async () => {
      const {
        key,
        preloadedState,
        range,
        dependencies,
        updateTimeRangeMock,
        templateVariableValueUpdatedMock,
        startRefreshMock,
      } = getTestContext(getDashboardModel());

      const tester = await reduxTester<RootReducerType>({ preloadedState })
        .givenRootReducer(getRootReducer())
        .whenActionIsDispatched(toKeyedAction(key, variablesInitTransaction({ uid: key })))
        .whenAsyncActionIsDispatched(onTimeRangeUpdated(key, range, dependencies));

      tester.thenDispatchedActionsShouldEqual(
        toKeyedAction(key, variablesInitTransaction({ uid: key })),
        toKeyedAction(key, variableStateFetching(toVariablePayload({ type: 'interval', id: 'interval-0' }))),
        toKeyedAction(key, createIntervalOptions(toVariablePayload({ type: 'interval', id: 'interval-0' }))),
        toKeyedAction(
          key,
          setCurrentVariableValue(
            toVariablePayload(
              { type: 'interval', id: 'interval-0' },
              { option: { text: '1m', value: '1m', selected: false } }
            )
          )
        ),
        toKeyedAction(key, variableStateCompleted(toVariablePayload({ type: 'interval', id: 'interval-0' })))
      );

      expect(updateTimeRangeMock).toHaveBeenCalledTimes(1);
      expect(updateTimeRangeMock).toHaveBeenCalledWith(range);
      expect(templateVariableValueUpdatedMock).toHaveBeenCalledTimes(1);
      expect(startRefreshMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('and options are not changed by update', () => {
    it('then correct actions are dispatched and correct dependencies are called', async () => {
      const {
        key,
        interval,
        preloadedState,
        range,
        dependencies,
        updateTimeRangeMock,
        templateVariableValueUpdatedMock,
        startRefreshMock,
      } = getTestContext(getDashboardModel());

      const base = await reduxTester<RootReducerType>({ preloadedState })
        .givenRootReducer(getRootReducer())
        .whenActionIsDispatched(toKeyedAction(key, variablesInitTransaction({ uid: key })))
        .whenAsyncActionIsDispatched(
          setOptionAsCurrent(toKeyedVariableIdentifier(interval), interval.options[0], false)
        );

      const tester = await base.whenAsyncActionIsDispatched(onTimeRangeUpdated(key, range, dependencies), true);

      tester.thenDispatchedActionsShouldEqual(
        toKeyedAction(key, variableStateFetching(toVariablePayload({ type: 'interval', id: 'interval-0' }))),
        toKeyedAction(key, createIntervalOptions(toVariablePayload({ type: 'interval', id: 'interval-0' }))),
        toKeyedAction(
          key,
          setCurrentVariableValue(
            toVariablePayload(
              { type: 'interval', id: 'interval-0' },
              { option: { text: '1m', value: '1m', selected: false } }
            )
          )
        ),
        toKeyedAction(key, variableStateCompleted(toVariablePayload({ type: 'interval', id: 'interval-0' })))
      );

      expect(updateTimeRangeMock).toHaveBeenCalledTimes(1);
      expect(updateTimeRangeMock).toHaveBeenCalledWith(range);
      expect(templateVariableValueUpdatedMock).toHaveBeenCalledTimes(0);
      expect(startRefreshMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('and updateOptions throws', () => {
    silenceConsoleOutput();

    it('then correct actions are dispatched and correct dependencies are called', async () => {
      const {
        key,
        adapterInterval,
        preloadedState,
        range,
        dependencies,
        updateTimeRangeMock,
        templateVariableValueUpdatedMock,
        startRefreshMock,
      } = getTestContext(getDashboardModel());

      adapterInterval.updateOptions = jest.fn().mockRejectedValue(new Error('Something broke'));

      const tester = await reduxTester<RootReducerType>({ preloadedState, debug: true })
        .givenRootReducer(getRootReducer())
        .whenActionIsDispatched(toKeyedAction(key, variablesInitTransaction({ uid: key })))
        .whenAsyncActionIsDispatched(onTimeRangeUpdated(key, range, dependencies), true);

      tester.thenDispatchedActionsPredicateShouldEqual((dispatchedActions) => {
        expect(dispatchedActions[0]).toEqual(
          toKeyedAction(key, variableStateFetching(toVariablePayload({ type: 'interval', id: 'interval-0' })))
        );
        expect(dispatchedActions[1]).toEqual(
          toKeyedAction(
            key,
            variableStateFailed(
              toVariablePayload({ type: 'interval', id: 'interval-0' }, { error: new Error('Something broke') })
            )
          )
        );
        expect(dispatchedActions[2].type).toEqual(notifyApp.type);
        expect(dispatchedActions[2].payload.title).toEqual('Templating');
        expect(dispatchedActions[2].payload.text).toEqual('Template variable service failed Something broke');
        expect(dispatchedActions[2].payload.severity).toEqual('error');
        return dispatchedActions.length === 3;
      });

      expect(updateTimeRangeMock).toHaveBeenCalledTimes(1);
      expect(updateTimeRangeMock).toHaveBeenCalledWith(range);
      expect(templateVariableValueUpdatedMock).toHaveBeenCalledTimes(0);
      expect(startRefreshMock).toHaveBeenCalledTimes(0);
    });
  });

  describe('When onTimeRangeUpdated is dispatched without refactorVariablesTimeRange feature flag ', () => {
    silenceConsoleOutput();
    it('then with old getVariablesThatNeedRefresh we call all of them in pararell', async () => {
      const { key, preloadedState, range, dependencies } = getTestContextVariables(getDashboardModel(), {});

      // Spying on timeRangeUpdated action
      const spyTimeRangeUpdated = jest.spyOn(actions, 'timeRangeUpdated');

      // Initiating the Redux testing environment

      await reduxTester<RootReducerType>({ preloadedState, debug: true })
        .givenRootReducer(getRootReducer())
        .whenActionIsDispatched(toKeyedAction(key, variablesInitTransaction({ uid: key })))
        .whenAsyncActionIsDispatched(onTimeRangeUpdated(key, range, dependencies), true);

      // Using the old algorithm, all variables configured to refresh on time range are expected to be refreshed,
      // irrespective of their dependencies. Thus, 'a', 'b', 'c', and 'interval' are expected to be refreshed.
      // - 'a', 'b', 'c' are query variables, and 'interval' is an interval variable.
      // - 'b' and 'c' depend on 'a', but this does not matter in the old algorithm, as all are refreshed in parallel.

      const expectedVariables = {
        queryA: {
          id: 'a',
          type: 'query',
          rootStateKey: 'key',
        },
        queryB: {
          id: 'b',
          type: 'query',
          rootStateKey: 'key',
        },
        queryC: {
          id: 'c',
          type: 'query',
          rootStateKey: 'key',
        },
        queryD: {
          id: 'd',
          type: 'query',
          rootStateKey: 'key',
        },
        interval: {
          id: 'interval-0',
          type: 'interval',
          rootStateKey: 'key',
        },
      };
      // Asserting that timeRangeUpdated action has been called with the correct arguments
      expect(spyTimeRangeUpdated).toHaveBeenCalledWith(expectedVariables.queryA);
      expect(spyTimeRangeUpdated).toHaveBeenCalledWith(expectedVariables.queryB);
      expect(spyTimeRangeUpdated).toHaveBeenCalledWith(expectedVariables.queryC);
      expect(spyTimeRangeUpdated).toHaveBeenCalledWith(expectedVariables.interval);

      expect(spyTimeRangeUpdated).toHaveBeenCalledTimes(5);

      spyTimeRangeUpdated.mockRestore();
    });
  });

  describe('On dispatch of onTimeRangeUpdated with refactorVariablesTimeRange feature flag', () => {
    silenceConsoleOutput();
    beforeAll(() => {
      config.featureToggles.refactorVariablesTimeRange = true;
    });
    afterAll(() => {
      config.featureToggles.refactorVariablesTimeRange = false;
    });

    it('should refresh only the independent query variables and those with dependents, optimising the number of calls when working with chained query variables', async () => {
      const { key, preloadedState, range, dependencies } = getTestContextVariables(getDashboardModel());

      // Spying on timeRangeUpdated action
      const spyTimeRangeUpdated = jest.spyOn(actions, 'timeRangeUpdated');

      // Initiating the Redux testing environment
      await reduxTester<RootReducerType>({ preloadedState, debug: true })
        .givenRootReducer(getRootReducer())
        .whenActionIsDispatched(toKeyedAction(key, variablesInitTransaction({ uid: key })))
        .whenAsyncActionIsDispatched(onTimeRangeUpdated(key, range, dependencies), true);

      // Defining the variables that are expected to be refreshed
      // Based on the algorithm of getVariablesThatNeedRefreshNew, we have the following variables:
      // - queryA: This is a Query variable and has no dependents. According to the algorithm, Query variables without dependents
      //   should be refreshed. Hence, it's expected to be in the refreshed variables list.
      // - queryD and interval: These are variables without any dependents. Similar to queryA, the algorithm specifies that
      //   variables without dependents should be refreshed when the time range changes.
      //   Note: Variables 'b' and 'c' are not expected to be in the refreshed variables list even though they're set to
      // refresh on time range change. This is because they have dependencies ('b' and 'c' depend on 'a'). The algorithm
      // optimizes the refreshing process by refreshing only independent variables and those that have dependents.
      // Once 'a' is refreshed, it will trigger a cascading refresh of 'b' and 'c'.

      const expectedVariables = {
        queryA: {
          id: 'a',
          type: 'query',
          rootStateKey: 'key',
        },
        queryD: {
          id: 'd',
          type: 'query',
          rootStateKey: 'key',
        },
        interval: {
          id: 'interval-0',
          type: 'interval',
          rootStateKey: 'key',
        },
      };

      // Asserting that timeRangeUpdated action has been called with the correct arguments
      expect(spyTimeRangeUpdated).toHaveBeenCalledWith(expectedVariables.queryA);
      expect(spyTimeRangeUpdated).toHaveBeenCalledWith(expectedVariables.queryD);
      expect(spyTimeRangeUpdated).toHaveBeenCalledTimes(3);

      spyTimeRangeUpdated.mockRestore();
    });

    // query variables can depend on datasource variables, but currently datasource variables do not refresh on time
    // range change via the UI. This test ensures that query variables that depend on datasource variables are refreshed
    it('Should ensure query variable is refreshed when dependent on a non-refreshing datasource variable', async () => {
      const dataSourceVariable = datasourceBuilder()
        .withId('dsVar')
        .withRootStateKey('key')
        .withName('datasource-1')
        .withOptions('a ds')
        .withCurrent('a ds')
        .build();

      const queryE = queryBuilder()
        .withId('e')
        .withName('e')
        .withRootStateKey('key')
        .withQuery('query ${dsVar}')
        .withRefresh(VariableRefresh.onTimeRangeChanged)
        .build();

      const queryF = queryBuilder()
        .withId('f')
        .withName('f')
        .withRootStateKey('key')
        .withQuery('query ${e}')
        .withRefresh(VariableRefresh.onTimeRangeChanged)
        .build();

      const customVariables = {
        dsVar: dataSourceVariable,
        queryE,
        queryF,
      };

      const { key, preloadedState, range, dependencies } = getTestContextVariables(
        getDashboardModel(),
        customVariables
      );

      // Spying on timeRangeUpdated action
      const spyTimeRangeUpdated = jest.spyOn(actions, 'timeRangeUpdated');

      // Initiating the Redux testing environment
      await reduxTester<RootReducerType>({ preloadedState, debug: true })
        .givenRootReducer(getRootReducer())
        .whenActionIsDispatched(toKeyedAction(key, variablesInitTransaction({ uid: key })))
        .whenAsyncActionIsDispatched(onTimeRangeUpdated(key, range, dependencies), true);

      // Defining the variables that are expected to be refreshed
      // Based on the algorithm of getVariablesThatNeedRefreshNew, we have the following variables:
      // - queryA, queryD and interval: These are variables with no dependents. According to the algorithm, should be refreshed.
      // - queryE: This is a query variable with a dependent node (queryF) but also has a dependency on DsVar datasource variable.
      //   because DSVar is not configured to refresh on time range,this means that queryE is the
      //   variable that is expected to be refreshed
      // Note: Variables 'b' and 'c', f are not expected to be in the refreshed variables list even though they're set to
      // refresh on time range change. This is because they have dependencies ('b' and 'c' depend on 'a').

      const expectedVariables = {
        queryA: {
          id: 'a',
          type: 'query',
          rootStateKey: 'key',
        },
        queryD: {
          id: 'd',
          type: 'query',
          rootStateKey: 'key',
        },
        queryE: {
          id: 'e',
          type: 'query',
          rootStateKey: 'key',
        },

        interval: {
          id: 'interval-0',
          type: 'interval',
          rootStateKey: 'key',
        },
      };

      // Asserting that timeRangeUpdated action has been called with the correct arguments
      expect(spyTimeRangeUpdated).toHaveBeenCalledWith(expectedVariables.queryA);
      expect(spyTimeRangeUpdated).toHaveBeenCalledWith(expectedVariables.queryD);
      expect(spyTimeRangeUpdated).toHaveBeenCalledWith(expectedVariables.queryE);
      expect(spyTimeRangeUpdated).toHaveBeenCalledTimes(4);

      spyTimeRangeUpdated.mockRestore();
    });
  });
});

function getDashboardModel(): DashboardModel {
  return createDashboardModelFixture({ schemaVersion: 9999 }); // ignore any schema migrations
}
