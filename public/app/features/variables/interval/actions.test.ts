import { dateTime } from '@grafana/data';

import { reduxTester } from '../../../../test/core/redux/reduxTester';
import { silenceConsoleOutput } from '../../../../test/core/utils/silenceConsoleOutput';
import { notifyApp } from '../../../core/actions';
import { getTimeSrv, setTimeSrv, TimeSrv } from '../../dashboard/services/TimeSrv';
import { TemplateSrv } from '../../templating/template_srv';
import { variableAdapters } from '../adapters';
import { intervalBuilder } from '../shared/testing/builders';
import { updateOptions } from '../state/actions';
import { getRootReducer, RootReducerType } from '../state/helpers';
import { toKeyedAction } from '../state/keyedVariablesReducer';
import {
  addVariable,
  setCurrentVariableValue,
  variableStateFailed,
  variableStateFetching,
} from '../state/sharedReducer';
import { variablesInitTransaction } from '../state/transactionReducer';
import { toKeyedVariableIdentifier, toVariablePayload } from '../utils';

import { updateAutoValue, UpdateAutoValueDependencies, updateIntervalVariableOptions } from './actions';
import { createIntervalVariableAdapter } from './adapter';
import { createIntervalOptions } from './reducer';

describe('interval actions', () => {
  variableAdapters.setInit(() => [createIntervalVariableAdapter()]);
  describe('when updateIntervalVariableOptions is dispatched', () => {
    it('then correct actions are dispatched', async () => {
      const interval = intervalBuilder()
        .withId('0')
        .withRootStateKey('key')
        .withQuery('1s,1m,1h,1d')
        .withAuto(false)
        .build();

      const tester = await reduxTester<RootReducerType>()
        .givenRootReducer(getRootReducer())
        .whenActionIsDispatched(
          toKeyedAction('key', addVariable(toVariablePayload(interval, { global: false, index: 0, model: interval })))
        )
        .whenAsyncActionIsDispatched(updateIntervalVariableOptions(toKeyedVariableIdentifier(interval)), true);

      tester.thenDispatchedActionsShouldEqual(
        toKeyedAction('key', createIntervalOptions({ type: 'interval', id: '0', data: undefined })),
        toKeyedAction(
          'key',
          setCurrentVariableValue({
            type: 'interval',
            id: '0',
            data: { option: { text: '1s', value: '1s', selected: false } },
          })
        )
      );
    });
  });

  describe('when updateOptions is dispatched but something throws', () => {
    silenceConsoleOutput();
    const originalTimeSrv = getTimeSrv();
    beforeEach(() => {
      const timeSrvMock = {
        timeRange: jest.fn().mockReturnValue({
          from: dateTime(new Date()).subtract(1, 'days').toDate(),
          to: new Date(),
          raw: {
            from: 'now-1d',
            to: 'now',
          },
        }),
      } as unknown as TimeSrv;
      setTimeSrv(timeSrvMock);
    });

    afterEach(() => {
      setTimeSrv(originalTimeSrv);
    });

    it('then an notifyApp action should be dispatched', async () => {
      const interval = intervalBuilder()
        .withId('0')
        .withRootStateKey('key')
        .withQuery('1s,1m,1h,1d')
        .withAuto(true)
        .withAutoMin('1xyz') // illegal interval string
        .build();

      const tester = await reduxTester<RootReducerType>()
        .givenRootReducer(getRootReducer())
        .whenActionIsDispatched(
          toKeyedAction('key', addVariable(toVariablePayload(interval, { global: false, index: 0, model: interval })))
        )
        .whenActionIsDispatched(toKeyedAction('key', variablesInitTransaction({ uid: 'key' })))
        .whenAsyncActionIsDispatched(updateOptions(toKeyedVariableIdentifier(interval)), true);

      tester.thenDispatchedActionsPredicateShouldEqual((dispatchedActions) => {
        const expectedNumberOfActions = 4;
        expect(dispatchedActions[0]).toEqual(toKeyedAction('key', variableStateFetching(toVariablePayload(interval))));
        expect(dispatchedActions[1]).toEqual(toKeyedAction('key', createIntervalOptions(toVariablePayload(interval))));
        expect(dispatchedActions[2]).toEqual(
          toKeyedAction(
            'key',
            variableStateFailed(
              toVariablePayload(interval, {
                error: new Error(
                  'Invalid interval string, has to be either unit-less or end with one of the following units: "y, M, w, d, h, m, s, ms"'
                ),
              })
            )
          )
        );

        expect(dispatchedActions[3].type).toEqual(notifyApp.type);
        expect(dispatchedActions[3].payload.title).toEqual('Templating [0]');
        expect(dispatchedActions[3].payload.text).toEqual(
          'Error updating options: Invalid interval string, has to be either unit-less or end with one of the following units: "y, M, w, d, h, m, s, ms"'
        );
        expect(dispatchedActions[3].payload.severity).toEqual('error');

        return dispatchedActions.length === expectedNumberOfActions;
      });
    });

    describe('but there is no ongoing transaction', () => {
      it('then no actions are dispatched', async () => {
        const interval = intervalBuilder()
          .withId('0')
          .withRootStateKey('key')
          .withQuery('1s,1m,1h,1d')
          .withAuto(true)
          .withAutoMin('1xyz') // illegal interval string
          .build();

        const tester = await reduxTester<RootReducerType>()
          .givenRootReducer(getRootReducer())
          .whenActionIsDispatched(
            toKeyedAction('key', addVariable(toVariablePayload(interval, { global: false, index: 0, model: interval })))
          )
          .whenAsyncActionIsDispatched(updateOptions(toKeyedVariableIdentifier(interval)), true);

        tester.thenNoActionsWhereDispatched();
      });
    });
  });

  describe('when updateAutoValue is dispatched', () => {
    describe('and auto is false', () => {
      it('then no dependencies are called', async () => {
        const interval = intervalBuilder().withId('0').withRootStateKey('key').withAuto(false).build();

        const dependencies: UpdateAutoValueDependencies = {
          calculateInterval: jest.fn(),
          getTimeSrv: () => {
            return {
              timeRange: jest.fn().mockReturnValue({
                from: '2001-01-01',
                to: '2001-01-02',
                raw: {
                  from: '2001-01-01',
                  to: '2001-01-02',
                },
              }),
            } as unknown as TimeSrv;
          },
          templateSrv: {
            setGrafanaVariable: jest.fn(),
          } as unknown as TemplateSrv,
        };

        await reduxTester<RootReducerType>()
          .givenRootReducer(getRootReducer())
          .whenActionIsDispatched(
            toKeyedAction('key', addVariable(toVariablePayload(interval, { global: false, index: 0, model: interval })))
          )
          .whenAsyncActionIsDispatched(updateAutoValue(toKeyedVariableIdentifier(interval), dependencies), true);

        expect(dependencies.calculateInterval).toHaveBeenCalledTimes(0);
        expect(dependencies.getTimeSrv().timeRange).toHaveBeenCalledTimes(0);
        expect(dependencies.templateSrv.setGrafanaVariable).toHaveBeenCalledTimes(0);
      });
    });

    describe('and auto is true', () => {
      it('then correct dependencies are called', async () => {
        const interval = intervalBuilder()
          .withId('0')
          .withRootStateKey('key')
          .withName('intervalName')
          .withAuto(true)
          .withAutoCount(33)
          .withAutoMin('13s')
          .build();

        const timeRangeMock = jest.fn().mockReturnValue({
          from: '2001-01-01',
          to: '2001-01-02',
          raw: {
            from: '2001-01-01',
            to: '2001-01-02',
          },
        });
        const setGrafanaVariableMock = jest.fn();
        const dependencies: UpdateAutoValueDependencies = {
          calculateInterval: jest.fn().mockReturnValue({ interval: '10s' }),
          getTimeSrv: () => {
            return {
              timeRange: timeRangeMock,
            } as unknown as TimeSrv;
          },
          templateSrv: {
            setGrafanaVariable: setGrafanaVariableMock,
          } as unknown as TemplateSrv,
        };

        await reduxTester<RootReducerType>()
          .givenRootReducer(getRootReducer())
          .whenActionIsDispatched(
            toKeyedAction('key', addVariable(toVariablePayload(interval, { global: false, index: 0, model: interval })))
          )
          .whenAsyncActionIsDispatched(updateAutoValue(toKeyedVariableIdentifier(interval), dependencies), true);

        expect(dependencies.calculateInterval).toHaveBeenCalledTimes(1);
        expect(dependencies.calculateInterval).toHaveBeenCalledWith(
          {
            from: '2001-01-01',
            to: '2001-01-02',
            raw: {
              from: '2001-01-01',
              to: '2001-01-02',
            },
          },
          33,
          '13s'
        );
        expect(timeRangeMock).toHaveBeenCalledTimes(1);
        expect(setGrafanaVariableMock).toHaveBeenCalledTimes(2);
        expect(setGrafanaVariableMock.mock.calls[0][0]).toBe('$__auto_interval_intervalName');
        expect(setGrafanaVariableMock.mock.calls[0][1]).toBe('10s');
        expect(setGrafanaVariableMock.mock.calls[1][0]).toBe('$__auto_interval');
        expect(setGrafanaVariableMock.mock.calls[1][1]).toBe('10s');
      });
    });
  });
});
