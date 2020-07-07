import { dateTime, TimeRange } from '@grafana/data';

import { TemplateSrv } from '../../templating/template_srv';
import { Emitter } from '../../../core/utils/emitter';
import { onTimeRangeUpdated, OnTimeRangeUpdatedDependencies } from './actions';
import { DashboardModel } from '../../dashboard/state';
import { DashboardState } from '../../../types';
import { createIntervalVariableAdapter } from '../interval/adapter';
import { variableAdapters } from '../adapters';
import { createConstantVariableAdapter } from '../constant/adapter';
import { VariableRefresh } from '../types';
import { constantBuilder, intervalBuilder } from '../shared/testing/builders';

variableAdapters.setInit(() => [createIntervalVariableAdapter(), createConstantVariableAdapter()]);

const getOnTimeRangeUpdatedContext = (args: { update?: boolean; throw?: boolean }) => {
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
  const emitMock = jest.fn();
  const appEventsMock = ({ emit: emitMock } as unknown) as Emitter;
  const dependencies: OnTimeRangeUpdatedDependencies = { templateSrv: templateSrvMock, appEvents: appEventsMock };
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
  adapter.updateOptions = args.throw ? jest.fn().mockRejectedValue('Something broke') : jest.fn().mockResolvedValue({});

  // initial variable state
  const initialVariable = intervalBuilder()
    .withId('interval-0')
    .withName('interval-0')
    .withOptions('1m', '10m', '30m', '1h', '6h', '12h', '1d', '7d', '14d', '30d')
    .withCurrent('1m')
    .withRefresh(VariableRefresh.onTimeRangeChanged)
    .build();

  // the constant variable should be filtered out
  const constant = constantBuilder()
    .withId('constant-1')
    .withName('constant-1')
    .withOptions('a constant')
    .withCurrent('a constant')
    .build();
  const initialState = {
    templating: { variables: { '0': { ...initialVariable }, '1': { ...constant } } },
    dashboard,
  };

  // updated variable state
  const updatedVariable = intervalBuilder()
    .withId('interval-0')
    .withName('interval-0')
    .withOptions('1m')
    .withCurrent('1m')
    .withRefresh(VariableRefresh.onTimeRangeChanged)
    .build();

  const variable = args.update ? { ...updatedVariable } : { ...initialVariable };
  const state = { templating: { variables: { 'interval-0': variable, 'constant-1': { ...constant } } }, dashboard };
  const getStateMock = jest
    .fn()
    .mockReturnValueOnce(initialState)
    .mockReturnValue(state);
  const dispatchMock = jest.fn();

  return {
    range,
    dependencies,
    dispatchMock,
    getStateMock,
    updateTimeRangeMock,
    templateVariableValueUpdatedMock,
    startRefreshMock,
    emitMock,
  };
};

describe('when onTimeRangeUpdated is dispatched', () => {
  describe('and options are changed by update', () => {
    it('then correct dependencies are called', async () => {
      const {
        range,
        dependencies,
        dispatchMock,
        getStateMock,
        updateTimeRangeMock,
        templateVariableValueUpdatedMock,
        startRefreshMock,
        emitMock,
      } = getOnTimeRangeUpdatedContext({ update: true });

      await onTimeRangeUpdated(range, dependencies)(dispatchMock, getStateMock, undefined);

      expect(dispatchMock).toHaveBeenCalledTimes(0);
      expect(getStateMock).toHaveBeenCalledTimes(4);
      expect(updateTimeRangeMock).toHaveBeenCalledTimes(1);
      expect(updateTimeRangeMock).toHaveBeenCalledWith(range);
      expect(templateVariableValueUpdatedMock).toHaveBeenCalledTimes(1);
      expect(startRefreshMock).toHaveBeenCalledTimes(1);
      expect(emitMock).toHaveBeenCalledTimes(0);
    });
  });

  describe('and options are not changed by update', () => {
    it('then correct dependencies are called', async () => {
      const {
        range,
        dependencies,
        dispatchMock,
        getStateMock,
        updateTimeRangeMock,
        templateVariableValueUpdatedMock,
        startRefreshMock,
        emitMock,
      } = getOnTimeRangeUpdatedContext({ update: false });

      await onTimeRangeUpdated(range, dependencies)(dispatchMock, getStateMock, undefined);

      expect(dispatchMock).toHaveBeenCalledTimes(0);
      expect(getStateMock).toHaveBeenCalledTimes(3);
      expect(updateTimeRangeMock).toHaveBeenCalledTimes(1);
      expect(updateTimeRangeMock).toHaveBeenCalledWith(range);
      expect(templateVariableValueUpdatedMock).toHaveBeenCalledTimes(0);
      expect(startRefreshMock).toHaveBeenCalledTimes(1);
      expect(emitMock).toHaveBeenCalledTimes(0);
    });
  });

  describe('and updateOptions throws', () => {
    it('then correct dependencies are called', async () => {
      const {
        range,
        dependencies,
        dispatchMock,
        getStateMock,
        updateTimeRangeMock,
        templateVariableValueUpdatedMock,
        startRefreshMock,
        emitMock,
      } = getOnTimeRangeUpdatedContext({ update: false, throw: true });

      await onTimeRangeUpdated(range, dependencies)(dispatchMock, getStateMock, undefined);

      expect(dispatchMock).toHaveBeenCalledTimes(0);
      expect(getStateMock).toHaveBeenCalledTimes(1);
      expect(updateTimeRangeMock).toHaveBeenCalledTimes(1);
      expect(updateTimeRangeMock).toHaveBeenCalledWith(range);
      expect(templateVariableValueUpdatedMock).toHaveBeenCalledTimes(0);
      expect(startRefreshMock).toHaveBeenCalledTimes(0);
      expect(emitMock).toHaveBeenCalledTimes(1);
    });
  });
});
