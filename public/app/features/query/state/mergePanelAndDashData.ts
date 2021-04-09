import { combineLatest, merge, Observable, of, timer } from 'rxjs';
import { PanelData, toDataFrame } from '@grafana/data';
import { DashboardQueryRunnerResult } from './DashboardQueryRunner/types';
import { mergeMap, mergeMapTo, takeUntil } from 'rxjs/operators';
import { emptyResult } from './DashboardQueryRunner/utils';

export function mergePanelAndDashData(
  panelObservable: Observable<PanelData>,
  dashObservable: Observable<DashboardQueryRunnerResult>
): Observable<PanelData> {
  const slowDashResult: Observable<DashboardQueryRunnerResult> = merge(
    timer(200).pipe(mergeMapTo(emptyResult()), takeUntil(dashObservable)),
    dashObservable
  );

  return combineLatest([panelObservable, slowDashResult]).pipe(
    mergeMap((combined) => {
      const [panelData, dashData] = combined;

      if (Boolean(dashData.annotations?.length)) {
        if (!panelData.annotations) {
          panelData.annotations = [];
        }

        return of({
          ...panelData,
          annotations: panelData.annotations.concat(toDataFrame(dashData.annotations)),
        });
      }

      return of(panelData);
    })
  );
}
