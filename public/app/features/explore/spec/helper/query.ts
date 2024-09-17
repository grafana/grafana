import { from, Observable } from 'rxjs';

import { arrayToDataFrame, DataQueryResponse, FieldType } from '@grafana/data';

export function makeLogsQueryResponse(marker = ''): Observable<DataQueryResponse> {
  const df = arrayToDataFrame([{ ts: Date.now(), line: `custom log line ${marker}` }]);
  df.meta = {
    preferredVisualisationType: 'logs',
  };
  df.fields[0].type = FieldType.time;
  return from([{ data: [df] }]);
}

export function makeMetricsQueryResponse(): Observable<DataQueryResponse> {
  const df = arrayToDataFrame([{ ts: Date.now(), val: 1 }]);
  df.fields[0].type = FieldType.time;
  return from([{ data: [df] }]);
}
