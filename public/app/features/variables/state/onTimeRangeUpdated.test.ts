import { dateTime, TimeRange } from '@grafana/data';

import { TemplateSrv } from '../../templating/template_srv';
import { onTimeRangeUpdated, OnTimeRangeUpdatedDependencies, setOptionAsCurrent } from './actions';
import { DashboardModel } from '../../dashboard/state';
import { DashboardState } from '../../../types';
import { createIntervalVariableAdapter } from '../interval/adapter';
import { variableAdapters } from '../adapters';
import { createConstantVariableAdapter } from '../constant/adapter';
import { VariableRefresh } from '../types';
import { constantBuilder, intervalBuilder } from '../shared/testing/builders';
import { reduxTester } from '../../../../test/core/redux/reduxTester';
import { getPreloadedState, getRootReducer, RootReducerType } from './helpers';
import {
  setCurrentVariableValue,
  variableStateCompleted,
  variableStateFailed,
  variableStateFetching,
} from './sharedReducer';
import { createIntervalOptions } from '../interval/reducer';
import { silenceConsoleOutput } from '../../../../test/core/utils/silenceConsoleOutput';
import { notifyApp } from '../../../core/reducers/appNotification';
import { expect } from '../../../../test/lib/common';
import { appEvents } from '../../../core/core';
import { variablesInitTransaction } from './transactionReducer';
import { toKeyedAction } from './dashboardVariablesReducer';
import { toDashboardVariableIdentifier, toVariablePayload } from '../utils';

variableAdapters.setInit(() => [createIntervalVariableAdapter(), createConstantVariableAdapter()]);

const getTestContext = (dashboard: DashboardModel) => {
  jest.clearAllMocks();

  const uid = 'uid';
  const interval = intervalBuilder()
    .withId('interval-0')
    .withDashboardUid(uid)
    .withName('interval-0')
    .withOptions('1m', '10m', '30m', '1h', '6h', '12h', '1d', '7d', '14d', '30d')
    .withCurrent('1m')
    .withRefresh(VariableRefresh.onTimeRangeChanged)
    .build();

  const constant = constantBuilder()
    .withId('constant-1')
    .withDashboardUid(uid)
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
  const templateSrvMock = ({ updateTimeRange: updateTimeRangeMock } as unknown) as TemplateSrv;
  const dependencies: OnTimeRangeUpdatedDependencies = { templateSrv: templateSrvMock, events: appEvents };
  const templateVariableValueUpdatedMock = jest.fn();
  const startRefreshMock = jest.fn();
  dashboard.templateVariableValueUpdated = templateVariableValueUpdatedMock;
  dashboard.startRefresh = startRefreshMock;
  const dashboardState = ({
    getModel: () => dashboard,
  } as unknown) as DashboardState;
  const adapter = variableAdapters.get('interval');
  const templatingState = {
    variables: {
      'interval-0': { ...interval },
      'constant-1': { ...constant },
    },
  };
  const preloadedState = ({
    dashboard: dashboardState,
    ...getPreloadedState(uid, templatingState),
  } as unknown) as RootReducerType;

  return {
    uid,
    interval,
    range,
    dependencies,
    adapter,
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
        uid,
        preloadedState,
        range,
        dependencies,
        updateTimeRangeMock,
        templateVariableValueUpdatedMock,
        startRefreshMock,
      } = getTestContext(getDashboardModel());

      const tester = await reduxTester<RootReducerType>({ preloadedState })
        .givenRootReducer(getRootReducer())
        .whenActionIsDispatched(toKeyedAction(uid, variablesInitTransaction({ uid })))
        .whenAsyncActionIsDispatched(onTimeRangeUpdated(uid, range, dependencies));

      tester.thenDispatchedActionsShouldEqual(
        toKeyedAction(uid, variablesInitTransaction({ uid })),
        toKeyedAction(uid, variableStateFetching(toVariablePayload({ type: 'interval', id: 'interval-0' }))),
        toKeyedAction(uid, createIntervalOptions(toVariablePayload({ type: 'interval', id: 'interval-0' }))),
        toKeyedAction(
          uid,
          setCurrentVariableValue(
            toVariablePayload(
              { type: 'interval', id: 'interval-0' },
              { option: { text: '1m', value: '1m', selected: false } }
            )
          )
        ),
        toKeyedAction(uid, variableStateCompleted(toVariablePayload({ type: 'interval', id: 'interval-0' })))
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
        uid,
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
        .whenActionIsDispatched(toKeyedAction(uid, variablesInitTransaction({ uid })))
        .whenAsyncActionIsDispatched(
          setOptionAsCurrent(toDashboardVariableIdentifier(interval), interval.options[0], false)
        );

      const tester = await base.whenAsyncActionIsDispatched(onTimeRangeUpdated(uid, range, dependencies), true);

      tester.thenDispatchedActionsShouldEqual(
        toKeyedAction(uid, variableStateFetching(toVariablePayload({ type: 'interval', id: 'interval-0' }))),
        toKeyedAction(uid, createIntervalOptions(toVariablePayload({ type: 'interval', id: 'interval-0' }))),
        toKeyedAction(
          uid,
          setCurrentVariableValue(
            toVariablePayload(
              { type: 'interval', id: 'interval-0' },
              { option: { text: '1m', value: '1m', selected: false } }
            )
          )
        ),
        toKeyedAction(uid, variableStateCompleted(toVariablePayload({ type: 'interval', id: 'interval-0' })))
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
        uid,
        adapter,
        preloadedState,
        range,
        dependencies,
        updateTimeRangeMock,
        templateVariableValueUpdatedMock,
        startRefreshMock,
      } = getTestContext(getDashboardModel());

      adapter.updateOptions = jest.fn().mockRejectedValue(new Error('Something broke'));

      const tester = await reduxTester<RootReducerType>({ preloadedState, debug: true })
        .givenRootReducer(getRootReducer())
        .whenActionIsDispatched(toKeyedAction(uid, variablesInitTransaction({ uid })))
        .whenAsyncActionIsDispatched(onTimeRangeUpdated(uid, range, dependencies), true);

      tester.thenDispatchedActionsPredicateShouldEqual((dispatchedActions) => {
        expect(dispatchedActions[0]).toEqual(
          toKeyedAction(uid, variableStateFetching(toVariablePayload({ type: 'interval', id: 'interval-0' })))
        );
        expect(dispatchedActions[1]).toEqual(
          toKeyedAction(
            uid,
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
  return new DashboardModel({ schemaVersion: 9999 }); // ignore any schema migrations
}
