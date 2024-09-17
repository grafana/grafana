import { Observable, of } from 'rxjs';

import { getDefaultTimeRange, LoadingState, LogsModel } from '@grafana/data';

import { ExplorePanelData } from '../../../types';

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
