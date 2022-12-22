import { TestScheduler } from 'rxjs/testing';

import { AlertState, getDefaultTimeRange, LoadingState, PanelData, toDataFrame } from '@grafana/data';

import { mergePanelAndDashData } from './mergePanelAndDashData';

function getTestContext() {
  const timeRange = getDefaultTimeRange();
  const panelData: PanelData = {
    state: LoadingState.Done,
    series: [],
    annotations: [toDataFrame([{ id: 'panelData' }])],
    timeRange,
  };
  const scheduler: TestScheduler = new TestScheduler((actual, expected) => {
    expect(actual).toEqual(expected);
  });

  return { timeRange, scheduler, panelData };
}

describe('mergePanelAndDashboardData', () => {
  describe('when called and dashboard data contains annotations', () => {
    it('then the annotations should be combined', () => {
      const { panelData, timeRange, scheduler } = getTestContext();

      scheduler.run(({ cold, expectObservable }) => {
        const panelObservable = cold('a', { a: panelData });
        const dashObservable = cold('a', { a: { annotations: [{ id: 'dashData' }] } });

        const result = mergePanelAndDashData(panelObservable, dashObservable);

        expectObservable(result).toBe('a', {
          a: {
            state: LoadingState.Done,
            series: [],
            annotations: [toDataFrame([{ id: 'panelData' }]), toDataFrame([{ id: 'dashData' }])],
            timeRange,
          },
        });
      });

      scheduler.flush();
    });
  });

  describe('when called and dashboard data contains alert states', () => {
    it('then the alert states should be added', () => {
      const { panelData, timeRange, scheduler } = getTestContext();

      scheduler.run(({ cold, expectObservable }) => {
        const panelObservable = cold('a', { a: panelData });
        const dashObservable = cold('a', {
          a: {
            annotations: [],
            alertState: { id: 1, state: AlertState.OK, dashboardId: 1, panelId: 1, newStateDate: '' },
          },
        });

        const result = mergePanelAndDashData(panelObservable, dashObservable);

        expectObservable(result).toBe('a', {
          a: {
            state: LoadingState.Done,
            series: [],
            annotations: [toDataFrame([{ id: 'panelData' }]), toDataFrame([])],
            alertState: { id: 1, state: AlertState.OK, dashboardId: 1, panelId: 1, newStateDate: '' },
            timeRange,
          },
        });
      });

      scheduler.flush();
    });
  });

  describe('when called and dashboard data does not contain annotations or alertState', () => {
    it('then the panelData is unchanged', () => {
      const { panelData, timeRange, scheduler } = getTestContext();

      scheduler.run(({ cold, expectObservable }) => {
        const panelObservable = cold('a', { a: panelData });
        const dashObservable = cold('a', {
          a: {
            annotations: [],
          },
        });

        const result = mergePanelAndDashData(panelObservable, dashObservable);

        expectObservable(result).toBe('a', {
          a: {
            state: LoadingState.Done,
            series: [],
            annotations: [toDataFrame([{ id: 'panelData' }])],
            timeRange,
          },
        });
      });

      scheduler.flush();
    });
  });
});
