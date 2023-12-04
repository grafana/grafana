import { Observable, of } from 'rxjs';

import { LoadingState, LogsModel } from '@grafana/data';

import { ExplorePanelData } from '../../../types';
import { getDefaultLogsTimeRange } from '../state/utils';

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
    timeRange: getDefaultLogsTimeRange(),
    traceFrames: [],
  };

  return of(data);
};
