import { getTemplatingRootReducer } from '../state/helpers';
import { reduxTester } from '../../../../test/core/redux/reduxTester';
import { TemplatingState } from '../state/reducers';
import { initDashboardTemplating } from '../state/actions';
import { toVariableIdentifier } from '../state/types';
import {
  updateAutoValue,
  UpdateAutoValueDependencies,
  updateIntervalVariableOptions,
  UpdateIntervalVariableOptionsDependencies,
} from './actions';
import { createIntervalOptions } from './reducer';
import { setCurrentVariableValue } from '../state/sharedReducer';
import { variableAdapters } from '../adapters';
import { createIntervalVariableAdapter } from './adapter';
import { Emitter } from 'app/core/core';
import { AppEvents, dateTime } from '@grafana/data';
import { getTimeSrv, setTimeSrv, TimeSrv } from '../../dashboard/services/TimeSrv';
import { TemplateSrv } from '../../templating/template_srv';
import { intervalBuilder } from '../shared/testing/builders';

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
        .givenRootReducer(getTemplatingRootReducer())
        .whenActionIsDispatched(initDashboardTemplating([interval]))
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

  describe('when updateIntervalVariableOptions is dispatched but something throws', () => {
    it('then an app event should be emitted', async () => {
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
        .withAutoMin('1') // illegal interval string
        .build();
      const appEventMock = ({
        emit: jest.fn(),
      } as unknown) as Emitter;
      const dependencies: UpdateIntervalVariableOptionsDependencies = { appEvents: appEventMock };

      await reduxTester<{ templating: TemplatingState }>()
        .givenRootReducer(getTemplatingRootReducer())
        .whenActionIsDispatched(initDashboardTemplating([interval]))
        .whenAsyncActionIsDispatched(updateIntervalVariableOptions(toVariableIdentifier(interval), dependencies), true);

      expect(appEventMock.emit).toHaveBeenCalledTimes(1);
      expect(appEventMock.emit).toHaveBeenCalledWith(AppEvents.alertError, [
        'Templating',
        'Invalid interval string, expecting a number followed by one of "Mwdhmsy"',
      ]);
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
          kbn: {
            calculateInterval: jest.fn(),
          },
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
          .givenRootReducer(getTemplatingRootReducer())
          .whenActionIsDispatched(initDashboardTemplating([interval]))
          .whenAsyncActionIsDispatched(updateAutoValue(toVariableIdentifier(interval), dependencies), true);

        expect(dependencies.kbn.calculateInterval).toHaveBeenCalledTimes(0);
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
          kbn: {
            calculateInterval: jest.fn().mockReturnValue({ interval: '10s' }),
          },
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
          .givenRootReducer(getTemplatingRootReducer())
          .whenActionIsDispatched(initDashboardTemplating([interval]))
          .whenAsyncActionIsDispatched(updateAutoValue(toVariableIdentifier(interval), dependencies), true);

        expect(dependencies.kbn.calculateInterval).toHaveBeenCalledTimes(1);
        expect(dependencies.kbn.calculateInterval).toHaveBeenCalledWith(
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
