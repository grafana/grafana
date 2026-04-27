import { combineLatest, type Observable, of } from 'rxjs';
import { mergeMap } from 'rxjs/operators';

import { arrayToDataFrame, type DataFrame } from '@grafana/data/dataframe';
import { DataTopic, type PanelData } from '@grafana/data/types';

import { type DashboardQueryRunnerResult } from './DashboardQueryRunner/types';

function addAnnoDataTopic(annotations: DataFrame[] = []) {
  annotations.forEach((f) => {
    f.meta = {
      ...f.meta,
      dataTopic: DataTopic.Annotations,
    };
  });
}

export function mergePanelAndDashData(
  panelObservable: Observable<PanelData>,
  dashObservable: Observable<DashboardQueryRunnerResult>
): Observable<PanelData> {
  return combineLatest([panelObservable, dashObservable]).pipe(
    mergeMap((combined) => {
      const [panelData, dashData] = combined;

      if (Boolean(dashData.annotations?.length) || Boolean(dashData.alertState)) {
        if (!panelData.annotations) {
          panelData.annotations = [];
        }

        const annotations = panelData.annotations.concat(arrayToDataFrame(dashData.annotations));

        addAnnoDataTopic(annotations);

        const alertState = dashData.alertState;
        return of({ ...panelData, annotations, alertState });
      }

      addAnnoDataTopic(panelData.annotations);

      return of(panelData);
    })
  );
}
