import { dateTime, type TimeRange, VariableRefresh } from '@grafana/data';
import { config, type DataSourceSrv } from '@grafana/runtime';
import * as runtime from '@grafana/runtime';
import { type DashboardState } from 'app/types/dashboard';

import { reduxTester } from '../../../../test/core/redux/reduxTester';
import { silenceConsoleOutput } from '../../../../test/core/utils/silenceConsoleOutput';
import { appEvents } from '../../../core/app_events';
import { notifyApp } from '../../../core/reducers/appNotification';
import { type DashboardModel } from '../../dashboard/state/DashboardModel';
import { createDashboardModelFixture } from '../../dashboard/state/__fixtures__/dashboardFixtures';
import { type TemplateSrv } from '../../templating/template_srv';
import { variableAdapters } from '../adapters';
import { createConstantVariableAdapter } from '../constant/adapter';
import { createDataSourceVariableAdapter } from '../datasource/adapter';
import { createIntervalVariableAdapter } from '../interval/adapter';
import { createIntervalOptions } from '../interval/reducer';
import { createQueryVariableAdapter } from '../query/adapter';
import { constantBuilder, intervalBuilder, queryBuilder, datasourceBuilder } from '../shared/testing/builders';
import { toKeyedVariableIdentifier, toVariablePayload } from '../utils';

import { onTimeRangeUpdated, type OnTimeRangeUpdatedDependencies, setOptionAsCurrent } from './actions';
import * as actions from './actions';
import { getPreloadedState, getRootReducer, type RootReducerType } from './helpers';
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
});

function getDashboardModel(): DashboardModel {
  return createDashboardModelFixture({ schemaVersion: 9999 }); // ignore any schema migrations
}
