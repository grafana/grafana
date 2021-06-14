import { asyncScheduler, Observable, of, scheduled } from 'rxjs';
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
  const panelObservable: Observable<PanelData> = scheduled(of(panelData), asyncScheduler);
  const dashObservable: Observable<DashboardQueryRunnerResult> = scheduled(of(dashData), asyncScheduler);

  return { timeRange, panelObservable, dashObservable, panelData, dashData };
}

// https://rxjs-dev.firebaseapp.com/guide/testing/marble-testing
function runMarbleTest(args: {
  panelMarble: string;
  dashMarble: string;
  panelValues: { [marble: string]: any };
  dashValues: { [marble: string]: any };
  expectedValues: { [marble: string]: any };
  expectedMarble: string;
}) {
  const { expectedValues, expectedMarble, panelMarble, panelValues, dashMarble, dashValues } = args;
  const scheduler: TestScheduler = new TestScheduler((actual, expected) => {
    expect(actual).toEqual(expected);
  });

  scheduler.run(({ cold, expectObservable }) => {
    const panelObservable = cold(panelMarble, panelValues);
    const dashObservable = cold(dashMarble, dashValues);
    const result = mergePanelAndDashData(panelObservable, dashObservable);
    expectObservable(result).toBe(expectedMarble, expectedValues);
  });
  scheduler.flush();
}

describe('mergePanelAndDashboardData', () => {
  describe('when both results are fast', () => {
    it('then just combine the results', () => {
      const { panelData, dashData, timeRange } = getTestContext();

      runMarbleTest({
        panelMarble: '10ms a',
        panelValues: { a: panelData },
        dashMarble: '10ms a',
        dashValues: { a: dashData },
        expectedMarble: '10ms a',
        expectedValues: {
          a: {
            state: LoadingState.Done,
            series: [],
            annotations: [toDataFrame([{ id: 'panelData' }]), toDataFrame([{ id: 'dashData' }])],
            alertState: { id: 1, state: AlertState.OK, dashboardId: 1, panelId: 1, newStateDate: '' },
            timeRange,
          },
        },
      });
    });
  });

  describe('when dashboard results are slow', () => {
    it('then flush panel data first', () => {
      const { panelData, dashData, timeRange } = getTestContext();

      runMarbleTest({
        panelMarble: '10ms a',
        panelValues: { a: panelData },
        dashMarble: '210ms a',
        dashValues: { a: dashData },
        expectedMarble: '200ms a 9ms b',
        expectedValues: {
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
        },
      });
    });
  });

  describe('when panel results are slow', () => {
    it('then just combine the results', () => {
      const { panelData, dashData, timeRange } = getTestContext();

      runMarbleTest({
        panelMarble: '210ms a',
        panelValues: { a: panelData },
        dashMarble: '10ms a',
        dashValues: { a: dashData },
        expectedMarble: '210ms a',
        expectedValues: {
          a: {
            state: LoadingState.Done,
            series: [],
            annotations: [toDataFrame([{ id: 'panelData' }]), toDataFrame([{ id: 'dashData' }])],
            alertState: { id: 1, state: AlertState.OK, dashboardId: 1, panelId: 1, newStateDate: '' },
            timeRange,
          },
        },
      });
    });
  });

  describe('when both results are slow', () => {
    it('then flush panel data first', () => {
      const { panelData, dashData, timeRange } = getTestContext();

      runMarbleTest({
        panelMarble: '210ms a',
        panelValues: { a: panelData },
        dashMarble: '210ms a',
        dashValues: { a: dashData },
        expectedMarble: '210ms (ab)',
        expectedValues: {
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
        },
      });
    });
  });
});
