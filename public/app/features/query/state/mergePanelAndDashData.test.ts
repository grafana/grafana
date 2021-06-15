import { AlertState, getDefaultTimeRange, LoadingState, PanelData, toDataFrame } from '@grafana/data';

import { DashboardQueryRunnerResult } from './DashboardQueryRunner/types';
import { mergePanelAndDashData } from './mergePanelAndDashData';
import { TestScheduler } from 'rxjs/testing';

function getTestContext() {
  const timeRange = getDefaultTimeRange();
  const panelData: PanelData = {
    state: LoadingState.Done,
    series: [],
    annotations: [toDataFrame([{ id: 'panelData' }])],
    timeRange,
  };
  const dashData: DashboardQueryRunnerResult = {
    annotations: [{ id: 'dashData' }],
    alertState: { id: 1, state: AlertState.OK, dashboardId: 1, panelId: 1, newStateDate: '' },
  };
  const scheduler: TestScheduler = new TestScheduler((actual, expected) => {
    expect(actual).toEqual(expected);
  });

  return { timeRange, scheduler, panelData, dashData };
}

describe('mergePanelAndDashboardData', () => {
  describe('when both results are fast', () => {
    it('then just combine the results', () => {
      const { panelData, dashData, timeRange, scheduler } = getTestContext();

      scheduler.run(({ cold, expectObservable }) => {
        const panelObservable = cold('10ms a', { a: panelData });
        const dashObservable = cold('10ms a', { a: dashData });

        const result = mergePanelAndDashData(panelObservable, dashObservable);

        expectObservable(result).toBe('10ms a', {
          a: {
            state: LoadingState.Done,
            series: [],
            annotations: [toDataFrame([{ id: 'panelData' }]), toDataFrame([{ id: 'dashData' }])],
            alertState: { id: 1, state: AlertState.OK, dashboardId: 1, panelId: 1, newStateDate: '' },
            timeRange,
          },
        });
      });

      scheduler.flush();
    });
  });

  describe('when dashboard results are slow', () => {
    it('then flush panel data first', () => {
      const { panelData, dashData, timeRange, scheduler } = getTestContext();

      scheduler.run(({ cold, expectObservable }) => {
        const panelObservable = cold('10ms a', { a: panelData });
        const dashObservable = cold('210ms a', { a: dashData });

        const result = mergePanelAndDashData(panelObservable, dashObservable);

        expectObservable(result).toBe('200ms a 9ms b', {
          a: {
            state: LoadingState.Done,
            series: [],
            annotations: [toDataFrame([{ id: 'panelData' }])],
            timeRange,
          },
          b: {
            state: LoadingState.Done,
            series: [],
            annotations: [toDataFrame([{ id: 'panelData' }]), toDataFrame([{ id: 'dashData' }])],
            alertState: { id: 1, state: AlertState.OK, dashboardId: 1, panelId: 1, newStateDate: '' },
            timeRange,
          },
        });
      });

      scheduler.flush();
    });
  });

  describe('when panel results are slow', () => {
    it('then just combine the results', () => {
      const { panelData, dashData, timeRange, scheduler } = getTestContext();

      scheduler.run(({ cold, expectObservable }) => {
        const panelObservable = cold('210ms a', { a: panelData });
        const dashObservable = cold('10ms a', { a: dashData });

        const result = mergePanelAndDashData(panelObservable, dashObservable);

        expectObservable(result).toBe('210ms a', {
          a: {
            state: LoadingState.Done,
            series: [],
            annotations: [toDataFrame([{ id: 'panelData' }]), toDataFrame([{ id: 'dashData' }])],
            alertState: { id: 1, state: AlertState.OK, dashboardId: 1, panelId: 1, newStateDate: '' },
            timeRange,
          },
        });
      });

      scheduler.flush();
    });
  });

  describe('when both results are slow', () => {
    it('then flush panel data first', () => {
      const { panelData, dashData, timeRange, scheduler } = getTestContext();

      scheduler.run(({ cold, expectObservable }) => {
        const panelObservable = cold('210ms a', { a: panelData });
        const dashObservable = cold('210ms a', { a: dashData });

        const result = mergePanelAndDashData(panelObservable, dashObservable);

        expectObservable(result).toBe('210ms (ab)', {
          a: {
            state: LoadingState.Done,
            series: [],
            annotations: [toDataFrame([{ id: 'panelData' }])],
            timeRange,
          },
          b: {
            state: LoadingState.Done,
            series: [],
            annotations: [toDataFrame([{ id: 'panelData' }]), toDataFrame([{ id: 'dashData' }])],
            alertState: { id: 1, state: AlertState.OK, dashboardId: 1, panelId: 1, newStateDate: '' },
            timeRange,
          },
        });
      });

      scheduler.flush();
    });
  });
});
