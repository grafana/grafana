import { combineLatest, merge, Observable, of, timer } from 'rxjs';
import { ArrayDataFrame, PanelData } from '@grafana/data';
import { DashboardQueryRunnerResult } from './DashboardQueryRunner/types';
import { mergeMap, mergeMapTo, takeUntil } from 'rxjs/operators';

export function mergePanelAndDashData(
  panelObservable: Observable<PanelData>,
  dashObservable: Observable<DashboardQueryRunnerResult>
): Observable<PanelData> {
  const slowDashResult: Observable<DashboardQueryRunnerResult> = merge(
    timer(200).pipe(mergeMapTo(of({ annotations: [], alertState: undefined })), takeUntil(dashObservable)),
    dashObservable
  );

  return combineLatest([panelObservable, slowDashResult]).pipe(
    mergeMap((combined) => {
      const [panelData, dashData] = combined;

      if (Boolean(dashData.annotations?.length) || Boolean(dashData.alertState)) {
        if (!panelData.annotations) {
          panelData.annotations = [];
        }

        return of({
          ...panelData,
          annotations: panelData.annotations.concat(new ArrayDataFrame(dashData.annotations)),
          alertState: dashData.alertState,
        });
      }

      return of(panelData);
    })
  );
}
