import { combineLatest, Observable, of } from 'rxjs';
import { mergeMap } from 'rxjs/operators';

import { arrayToDataFrame, DataFrame, DataTopic, PanelData, PanelPluginDataSupport } from '@grafana/data';

import { DashboardQueryRunnerResult } from './DashboardQueryRunner/types';

function addAnnoDataTopic(annotations: DataFrame[] = []) {
  annotations.forEach((f) => {
    f.meta = {
      ...f.meta,
      dataTopic: DataTopic.Annotations,
    };
  });
}

export function mergePanelAndDashData(
  dataSupport: PanelPluginDataSupport,
  panelObservable: Observable<PanelData>,
  dashObservable: Observable<DashboardQueryRunnerResult>
): Observable<PanelData> {
  return combineLatest([panelObservable, dashObservable]).pipe(
    mergeMap((combined) => {
      const [panelData, dashData] = combined;
      let mergedData = { ...panelData };

      // handle annotations
      if (dataSupport.annotations) {
        if (Boolean(dashData.annotations?.length)) {
          if (!panelData.annotations) {
            panelData.annotations = [];
          }
          const annotations = panelData.annotations.concat(arrayToDataFrame(dashData.annotations));

          addAnnoDataTopic(annotations);
          mergedData = { ...mergedData, annotations };
        } else {
          addAnnoDataTopic(panelData.annotations);
        }
      }

      // handle alertStates
      if (dataSupport.alertStates && Boolean(dashData.alertState)) {
        const alertState = dashData.alertState;
        mergedData = { ...mergedData, alertState };
      }
      return of(mergedData);
    })
  );
}
