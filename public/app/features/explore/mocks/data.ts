import { type Observable, of } from 'rxjs';

import { getDefaultTimeRange, LoadingState, type LogsModel } from '@grafana/data/types';
import { type ExplorePanelData } from 'app/types/explore';

type MockProps = {
  logsResult?: Partial<LogsModel>;
};

export const mockExplorePanelData = (props?: MockProps): Observable<ExplorePanelData> => {
  const data: ExplorePanelData = {
    flameGraphFrames: [],
    graphFrames: [],
    graphResult: [],
    customFrames: [],
    logsFrames: [],
    logsResult: {
      hasUniqueLabels: false,
      rows: [],
      meta: [],
      series: [],
      queries: [],
      ...(props?.logsResult || {}),
    },
    nodeGraphFrames: [],
    rawPrometheusFrames: [],
    rawPrometheusResult: null,
    series: [],
    state: LoadingState.Done,
    tableFrames: [],
    tableResult: [],
    timeRange: getDefaultTimeRange(),
    traceFrames: [],
  };

  return of(data);
};
