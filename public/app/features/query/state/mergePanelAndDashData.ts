import { combineLatest, merge, Observable, of, timer } from 'rxjs';
import { ArrayDataFrame, PanelData, PanelPluginDataSupport } from '@grafana/data';
import { DashboardQueryRunnerResult } from './DashboardQueryRunner/types';
import { map, mergeMap, mergeMapTo, takeUntil } from 'rxjs/operators';

export function mergePanelAndDashData(
  panelObservable: Observable<PanelData>,
  dashObservable: Observable<DashboardQueryRunnerResult>,
  dataSupport?: PanelPluginDataSupport
): Observable<PanelData> {
  const desiredObservable = dashObservable.pipe(
    map(({ annotations, alertState }) => ({
      annotations: dataSupport?.annotations ? annotations : [],
      alertState: dataSupport?.alertStates ? alertState : undefined,
    }))
  );

  const slowDashResult: Observable<DashboardQueryRunnerResult> = merge(
    timer(200).pipe(mergeMapTo(of({ annotations: [], alertState: undefined })), takeUntil(desiredObservable)),
    desiredObservable
  );

  return combineLatest([panelObservable, slowDashResult]).pipe(
    mergeMap((combined) => {
      const [panelData, dashData] = combined;

      return of({
        ...panelData,
        alertState: dashData.alertState,
        annotations: dashData.annotations?.length
          ? (panelData.annotations ?? []).concat(new ArrayDataFrame(dashData.annotations))
          : panelData.annotations,
      });
    })
  );
}
