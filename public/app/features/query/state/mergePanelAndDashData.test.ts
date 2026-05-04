import { TestScheduler } from 'rxjs/testing';

import { AlertState, DataTopic, getDefaultTimeRange, LoadingState, type PanelData, toDataFrame } from '@grafana/data';

import { mergePanelAndDashData } from './mergePanelAndDashData';

function toAnnotationFrame(data: Array<Record<'id', number | string>>) {
  let frame = toDataFrame(data);
  frame.meta = { dataTopic: DataTopic.Annotations };
  return frame;
}

function getTestContext() {
  const timeRange = getDefaultTimeRange();
  const panelData: PanelData = {
    state: LoadingState.Done,
    series: [],
    annotations: [toDataFrame([{ id: 1 }])],
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
        const dashObservable = cold('a', { a: { annotations: [{ id: '2' }] } });

        const result = mergePanelAndDashData(panelObservable, dashObservable);

        expectObservable(result).toBe('a', {
          a: {
            state: LoadingState.Done,
            series: [],
            annotations: [toAnnotationFrame([{ id: 1 }]), toAnnotationFrame([{ id: '2' }])],
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
            alertState: { id: 1, state: AlertState.OK, dashboardUID: 'aaa', panelId: 1, newStateDate: '' },
          },
        });

        const result = mergePanelAndDashData(panelObservable, dashObservable);

        expectObservable(result).toBe('a', {
          a: {
            state: LoadingState.Done,
            series: [],
            annotations: [toAnnotationFrame([{ id: 1 }]), toAnnotationFrame([])],
            alertState: { id: 1, state: AlertState.OK, dashboardUID: 'aaa', panelId: 1, newStateDate: '' },
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
            annotations: [toAnnotationFrame([{ id: 1 }])],
            timeRange,
          },
        });
      });

      scheduler.flush();
    });
  });
});
