import { combineLatest, mergeMap, Observable, of } from 'rxjs';

import { ArrayDataFrame, PanelData } from '@grafana/data';

import { DashboardQueryRunnerResult } from './DashboardQueryRunner/types';

export function mergePanelAndDashData(
  panelObservable: Observable<PanelData>,
  dashObservable: Observable<DashboardQueryRunnerResult>
): Observable<PanelData> {
  return combineLatest([panelObservable, dashObservable]).pipe(
    mergeMap((data) => {
      const [panelData, dashData] = data;

      if (Boolean(dashData.annotations?.length) || Boolean(dashData.alertState) || Boolean(dashData.threshold)) {
        if (!panelData.annotations) {
          panelData.annotations = [];
        }

        const annotations = panelData.annotations.concat(new ArrayDataFrame(dashData.annotations));
        const alertState = dashData.alertState;
        const threshold = dashData.threshold;

        return of({ ...panelData, annotations, alertState, threshold });
      }

      return of(panelData);
    })
  );
}
