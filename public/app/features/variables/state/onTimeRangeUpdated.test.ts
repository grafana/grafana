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
import { TemplatingState } from './reducers';
import { getRootReducer } from './helpers';
import { toVariableIdentifier, toVariablePayload } from './types';
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

variableAdapters.setInit(() => [createIntervalVariableAdapter(), createConstantVariableAdapter()]);

const getTestContext = () => {
  const interval = intervalBuilder()
    .withId('interval-0')
    .withName('interval-0')
    .withOptions('1m', '10m', '30m', '1h', '6h', '12h', '1d', '7d', '14d', '30d')
    .withCurrent('1m')
    .withRefresh(VariableRefresh.onTimeRangeChanged)
    .build();

  const constant = constantBuilder()
    .withId('constant-1')
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
  const dependencies: OnTimeRangeUpdatedDependencies = { templateSrv: templateSrvMock };
  const templateVariableValueUpdatedMock = jest.fn();
  const dashboard = ({
    getModel: () =>
      (({
        templateVariableValueUpdated: templateVariableValueUpdatedMock,
        startRefresh: startRefreshMock,
      } as unknown) as DashboardModel),
  } as unknown) as DashboardState;
  const startRefreshMock = jest.fn();
  const adapter = variableAdapters.get('interval');
  const preloadedState = {
    dashboard,
    location: { query: '' },
    templating: ({
      variables: {
        'interval-0': { ...interval },
        'constant-1': { ...constant },
      },
    } as unknown) as TemplatingState,
  };

  return {
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
        preloadedState,
        range,
        dependencies,
        updateTimeRangeMock,
        templateVariableValueUpdatedMock,
        startRefreshMock,
      } = getTestContext();

      const tester = await reduxTester<{ templating: TemplatingState }>({ preloadedState })
        .givenRootReducer(getRootReducer())
        .whenAsyncActionIsDispatched(onTimeRangeUpdated(range, dependencies));

      tester.thenDispatchedActionsShouldEqual(
        variableStateFetching(toVariablePayload({ type: 'interval', id: 'interval-0' })),
        createIntervalOptions(toVariablePayload({ type: 'interval', id: 'interval-0' })),
        setCurrentVariableValue(
          toVariablePayload(
            { type: 'interval', id: 'interval-0' },
            { option: { text: '1m', value: '1m', selected: false } }
          )
        ),
        variableStateCompleted(toVariablePayload({ type: 'interval', id: 'interval-0' }))
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
        interval,
        preloadedState,
        range,
        dependencies,
        updateTimeRangeMock,
        templateVariableValueUpdatedMock,
        startRefreshMock,
      } = getTestContext();

      const tester = await reduxTester<{ templating: TemplatingState }>({ preloadedState })
        .givenRootReducer(getRootReducer())
        .whenActionIsDispatched(setOptionAsCurrent(toVariableIdentifier(interval), interval.options[0], false))
        .whenAsyncActionIsDispatched(onTimeRangeUpdated(range, dependencies), true);

      tester.thenDispatchedActionsShouldEqual(
        variableStateFetching(toVariablePayload({ type: 'interval', id: 'interval-0' })),
        createIntervalOptions(toVariablePayload({ type: 'interval', id: 'interval-0' })),
        setCurrentVariableValue(
          toVariablePayload(
            { type: 'interval', id: 'interval-0' },
            { option: { text: '1m', value: '1m', selected: false } }
          )
        ),
        variableStateCompleted(toVariablePayload({ type: 'interval', id: 'interval-0' }))
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
        adapter,
        preloadedState,
        range,
        dependencies,
        updateTimeRangeMock,
        templateVariableValueUpdatedMock,
        startRefreshMock,
      } = getTestContext();

      adapter.updateOptions = jest.fn().mockRejectedValue(new Error('Something broke'));

      const tester = await reduxTester<{ templating: TemplatingState }>({ preloadedState, debug: true })
        .givenRootReducer(getRootReducer())
        .whenAsyncActionIsDispatched(onTimeRangeUpdated(range, dependencies), true);

      tester.thenDispatchedActionsPredicateShouldEqual(dispatchedActions => {
        expect(dispatchedActions[0]).toEqual(
          variableStateFetching(toVariablePayload({ type: 'interval', id: 'interval-0' }))
        );
        expect(dispatchedActions[1]).toEqual(
          variableStateFailed(
            toVariablePayload({ type: 'interval', id: 'interval-0' }, { error: new Error('Something broke') })
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
