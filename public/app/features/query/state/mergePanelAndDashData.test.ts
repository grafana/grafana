import { asyncScheduler, Observable, of, scheduled } from 'rxjs';
import {
  AlertState,
  getDefaultTimeRange,
  LoadingState,
  PanelData,
  PanelPluginDataSupport,
  toDataFrame,
} from '@grafana/data';

import { DashboardQueryRunnerResult } from './DashboardQueryRunner/types';
import { mergePanelAndDashData } from './mergePanelAndDashData';
import { delay } from 'rxjs/operators';

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

  return { timeRange, panelObservable, dashObservable };
}

const testCases: Array<PanelPluginDataSupport | undefined> = [
  { annotations: true, alertStates: true },
  { annotations: false, alertStates: false },
  { annotations: true, alertStates: false },
  { annotations: false, alertStates: true },
  undefined,
];

describe('mergePanelAndDashData', () => {
  describe('when both results are fast', () => {
    test.each(testCases)('then just combine the results (%s)', async (support) => {
      const { dashObservable, panelObservable, timeRange } = getTestContext();

      const expected = {
        state: LoadingState.Done,
        series: [],
        annotations: support?.annotations
          ? [toDataFrame([{ id: 'panelData' }]), toDataFrame([{ id: 'dashData' }])]
          : [toDataFrame([{ id: 'panelData' }])],
        alertState: support?.alertStates
          ? { id: 1, state: AlertState.OK, dashboardId: 1, panelId: 1, newStateDate: '' }
          : undefined,
        timeRange,
      };

      await expect(mergePanelAndDashData(panelObservable, dashObservable, support)).toEmitValuesWith((received) => {
        expect(received).toHaveLength(1);
        const results = received[0];
        expect(results).toEqual(expected);
      });
    });
  });

  describe('when dashboard results are slow', () => {
    test.each(testCases)('then flush panel data first (%s)', async (support) => {
      const { dashObservable, panelObservable, timeRange } = getTestContext();

      await expect(mergePanelAndDashData(panelObservable, dashObservable.pipe(delay(250)), support)).toEmitValuesWith(
        (received) => {
          expect(received).toHaveLength(2);
          const fastResults = received[0];
          expect(fastResults).toEqual({
            state: LoadingState.Done,
            series: [],
            annotations: [toDataFrame([{ id: 'panelData' }])],
            alertState: undefined,
            timeRange,
          });

          const slowResults = received[1];
          const expectedSlowResults = {
            state: LoadingState.Done,
            series: [],
            annotations: support?.annotations
              ? [toDataFrame([{ id: 'panelData' }]), toDataFrame([{ id: 'dashData' }])]
              : [toDataFrame([{ id: 'panelData' }])],
            alertState: support?.alertStates
              ? { id: 1, state: AlertState.OK, dashboardId: 1, panelId: 1, newStateDate: '' }
              : undefined,
            timeRange,
          };
          expect(slowResults).toEqual(expectedSlowResults);
        }
      );
    });
  });

  describe('when panel results are slow', () => {
    test.each(testCases)('then just combine the results (%s)', async (support) => {
      const { dashObservable, panelObservable, timeRange } = getTestContext();

      await expect(mergePanelAndDashData(panelObservable.pipe(delay(250)), dashObservable, support)).toEmitValuesWith(
        (received) => {
          expect(received).toHaveLength(1);
          const results = received[0];
          const expectedResults = {
            state: LoadingState.Done,
            series: [],
            annotations: support?.annotations
              ? [toDataFrame([{ id: 'panelData' }]), toDataFrame([{ id: 'dashData' }])]
              : [toDataFrame([{ id: 'panelData' }])],
            alertState: support?.alertStates
              ? { id: 1, state: AlertState.OK, dashboardId: 1, panelId: 1, newStateDate: '' }
              : undefined,
            timeRange,
          };
          expect(results).toEqual(expectedResults);
        }
      );
    });
  });

  describe('when both results are slow', () => {
    test.each(testCases)('then flush panel data first (%s)', async (support) => {
      const { dashObservable, panelObservable, timeRange } = getTestContext();

      await expect(
        mergePanelAndDashData(panelObservable.pipe(delay(250)), dashObservable.pipe(delay(250)), support)
      ).toEmitValuesWith((received) => {
        expect(received).toHaveLength(2);
        const fastResults = received[0];
        expect(fastResults).toEqual({
          state: LoadingState.Done,
          series: [],
          annotations: [toDataFrame([{ id: 'panelData' }])],
          alertState: undefined,
          timeRange,
        });

        const slowResults = received[1];
        const expectedSlowResults = {
          state: LoadingState.Done,
          series: [],
          annotations: support?.annotations
            ? [toDataFrame([{ id: 'panelData' }]), toDataFrame([{ id: 'dashData' }])]
            : [toDataFrame([{ id: 'panelData' }])],
          alertState: support?.alertStates
            ? { id: 1, state: AlertState.OK, dashboardId: 1, panelId: 1, newStateDate: '' }
            : undefined,
          timeRange,
        };
        expect(slowResults).toEqual(expectedSlowResults);
      });
    });
  });
});
