import { getRootReducer } from '../state/helpers';
import { reduxTester } from '../../../../test/core/redux/reduxTester';
import { TemplatingState } from '../state/reducers';
import { toVariableIdentifier, toVariablePayload } from '../state/types';
import { updateAutoValue, UpdateAutoValueDependencies, updateIntervalVariableOptions } from './actions';
import { createIntervalOptions } from './reducer';
import {
  addVariable,
  setCurrentVariableValue,
  variableStateFailed,
  variableStateFetching,
} from '../state/sharedReducer';
import { variableAdapters } from '../adapters';
import { createIntervalVariableAdapter } from './adapter';
import { dateTime } from '@grafana/data';
import { getTimeSrv, setTimeSrv, TimeSrv } from '../../dashboard/services/TimeSrv';
import { TemplateSrv } from '../../templating/template_srv';
import { intervalBuilder } from '../shared/testing/builders';
import { updateOptions } from '../state/actions';
import { notifyApp } from '../../../core/actions';
import { silenceConsoleOutput } from '../../../../test/core/utils/silenceConsoleOutput';

describe('interval actions', () => {
  variableAdapters.setInit(() => [createIntervalVariableAdapter()]);
  describe('when updateIntervalVariableOptions is dispatched', () => {
    it('then correct actions are dispatched', async () => {
      const interval = intervalBuilder()
        .withId('0')
        .withQuery('1s,1m,1h,1d')
        .withAuto(false)
        .build();

      const tester = await reduxTester<{ templating: TemplatingState }>()
        .givenRootReducer(getRootReducer())
        .whenActionIsDispatched(addVariable(toVariablePayload(interval, { global: false, index: 0, model: interval })))
        .whenAsyncActionIsDispatched(updateIntervalVariableOptions(toVariableIdentifier(interval)), true);

      tester.thenDispatchedActionsShouldEqual(
        createIntervalOptions({ type: 'interval', id: '0', data: undefined }),
        setCurrentVariableValue({
          type: 'interval',
          id: '0',
          data: { option: { text: '1s', value: '1s', selected: false } },
        })
      );
    });
  });

  describe('when updateOptions is dispatched but something throws', () => {
    silenceConsoleOutput();
    it('then an notifyApp action should be dispatched', async () => {
      const timeSrvMock = ({
        timeRange: jest.fn().mockReturnValue({
          from: dateTime(new Date())
            .subtract(1, 'days')
            .toDate(),
          to: new Date(),
          raw: {
            from: 'now-1d',
            to: 'now',
          },
        }),
      } as unknown) as TimeSrv;
      const originalTimeSrv = getTimeSrv();
      setTimeSrv(timeSrvMock);
      const interval = intervalBuilder()
        .withId('0')
        .withQuery('1s,1m,1h,1d')
        .withAuto(true)
        .withAutoMin('1xyz') // illegal interval string
        .build();

      const tester = await reduxTester<{ templating: TemplatingState }>()
        .givenRootReducer(getRootReducer())
        .whenActionIsDispatched(addVariable(toVariablePayload(interval, { global: false, index: 0, model: interval })))
        .whenAsyncActionIsDispatched(updateOptions(toVariableIdentifier(interval)), true);

      tester.thenDispatchedActionsPredicateShouldEqual(dispatchedActions => {
        const expectedNumberOfActions = 4;
        expect(dispatchedActions[0]).toEqual(variableStateFetching(toVariablePayload(interval)));
        expect(dispatchedActions[1]).toEqual(createIntervalOptions(toVariablePayload(interval)));
        expect(dispatchedActions[2]).toEqual(
          variableStateFailed(
            toVariablePayload(interval, {
              error: new Error(
                'Invalid interval string, has to be either unit-less or end with one of the following units: "y, M, w, d, h, m, s, ms"'
              ),
            })
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

      setTimeSrv(originalTimeSrv);
    });
  });

  describe('when updateAutoValue is dispatched', () => {
    describe('and auto is false', () => {
      it('then no dependencies are called', async () => {
        const interval = intervalBuilder()
          .withId('0')
          .withAuto(false)
          .build();

        const dependencies: UpdateAutoValueDependencies = {
          calculateInterval: jest.fn(),
          getTimeSrv: () => {
            return ({
              timeRange: jest.fn().mockReturnValue({
                from: '2001-01-01',
                to: '2001-01-02',
                raw: {
                  from: '2001-01-01',
                  to: '2001-01-02',
                },
              }),
            } as unknown) as TimeSrv;
          },
          templateSrv: ({
            setGrafanaVariable: jest.fn(),
          } as unknown) as TemplateSrv,
        };

        await reduxTester<{ templating: TemplatingState }>()
          .givenRootReducer(getRootReducer())
          .whenActionIsDispatched(
            addVariable(toVariablePayload(interval, { global: false, index: 0, model: interval }))
          )
          .whenAsyncActionIsDispatched(updateAutoValue(toVariableIdentifier(interval), dependencies), true);

        expect(dependencies.calculateInterval).toHaveBeenCalledTimes(0);
        expect(dependencies.getTimeSrv().timeRange).toHaveBeenCalledTimes(0);
        expect(dependencies.templateSrv.setGrafanaVariable).toHaveBeenCalledTimes(0);
      });
    });

    describe('and auto is true', () => {
      it('then correct dependencies are called', async () => {
        const interval = intervalBuilder()
          .withId('0')
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
            return ({
              timeRange: timeRangeMock,
            } as unknown) as TimeSrv;
          },
          templateSrv: ({
            setGrafanaVariable: setGrafanaVariableMock,
          } as unknown) as TemplateSrv,
        };

        await reduxTester<{ templating: TemplatingState }>()
          .givenRootReducer(getRootReducer())
          .whenActionIsDispatched(
            addVariable(toVariablePayload(interval, { global: false, index: 0, model: interval }))
          )
          .whenAsyncActionIsDispatched(updateAutoValue(toVariableIdentifier(interval), dependencies), true);

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
