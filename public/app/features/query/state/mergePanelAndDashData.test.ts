import { asyncScheduler, Observable, of, scheduled } from 'rxjs';
import { AlertState, getDefaultTimeRange, LoadingState, PanelData, toDataFrame } from '@grafana/data';

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

describe('mergePanelAndDashboardData', () => {
  describe('when both results are fast', () => {
    it('then just combine the results', async () => {
      const { dashObservable, panelObservable, timeRange } = getTestContext();

      await expect(mergePanelAndDashData(panelObservable, dashObservable)).toEmitValuesWith((received) => {
        expect(received).toHaveLength(1);
        const results = received[0];
        expect(results).toEqual({
          state: LoadingState.Done,
          series: [],
          annotations: [toDataFrame([{ id: 'panelData' }]), toDataFrame([{ id: 'dashData' }])],
          alertState: { id: 1, state: AlertState.OK, dashboardId: 1, panelId: 1, newStateDate: '' },
          timeRange,
        });
      });
    });
  });

  describe('when dashboard results are slow', () => {
    it('then flush panel data first', async () => {
      const { dashObservable, panelObservable, timeRange } = getTestContext();

      await expect(mergePanelAndDashData(panelObservable, dashObservable.pipe(delay(250)))).toEmitValuesWith(
        (received) => {
          expect(received).toHaveLength(2);
          const fastResults = received[0];
          const slowResults = received[1];
          expect(fastResults).toEqual({
            state: LoadingState.Done,
            series: [],
            annotations: [toDataFrame([{ id: 'panelData' }])],
            alertState: undefined,
            timeRange,
          });
          expect(slowResults).toEqual({
            state: LoadingState.Done,
            series: [],
            annotations: [toDataFrame([{ id: 'panelData' }]), toDataFrame([{ id: 'dashData' }])],
            alertState: { id: 1, state: AlertState.OK, dashboardId: 1, panelId: 1, newStateDate: '' },
            timeRange,
          });
        }
      );
    });
  });

  describe('when panel results are slow', () => {
    it('then just combine the results', async () => {
      const { dashObservable, panelObservable, timeRange } = getTestContext();

      await expect(mergePanelAndDashData(panelObservable.pipe(delay(250)), dashObservable)).toEmitValuesWith(
        (received) => {
          expect(received).toHaveLength(1);
          const results = received[0];
          expect(results).toEqual({
            state: LoadingState.Done,
            series: [],
            annotations: [toDataFrame([{ id: 'panelData' }]), toDataFrame([{ id: 'dashData' }])],
            alertState: { id: 1, state: AlertState.OK, dashboardId: 1, panelId: 1, newStateDate: '' },
            timeRange,
          });
        }
      );
    });
  });

  describe('when both results are slow', () => {
    it('then flush panel data first', async () => {
      const { dashObservable, panelObservable, timeRange } = getTestContext();

      await expect(
        mergePanelAndDashData(panelObservable.pipe(delay(250)), dashObservable.pipe(delay(250)))
      ).toEmitValuesWith((received) => {
        expect(received).toHaveLength(2);
        const fastResults = received[0];
        const slowResults = received[1];
        expect(fastResults).toEqual({
          state: LoadingState.Done,
          series: [],
          annotations: [toDataFrame([{ id: 'panelData' }])],
          alertState: undefined,
          timeRange,
        });
        expect(slowResults).toEqual({
          state: LoadingState.Done,
          series: [],
          annotations: [toDataFrame([{ id: 'panelData' }]), toDataFrame([{ id: 'dashData' }])],
          alertState: { id: 1, state: AlertState.OK, dashboardId: 1, panelId: 1, newStateDate: '' },
          timeRange,
        });
      });
    });
  });
});
