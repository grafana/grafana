import { Observable, merge } from 'rxjs';
// import { map } from 'rxjs/operators';

import { DataQueryRequest, DataQueryResponsePacket } from '@grafana/ui';

// import {
//   FieldType,
//   Field,
//   LoadingState,
//   LogLevel,
//   CSVReader,
//   DataFrameHelper,
//   CircularVector,
//   DataFrame,
// } from '@grafana/data';

import { TestDataQuery, StreamingQuery } from './types';

export const defaultQuery: StreamingQuery = {
  type: 'signal',
  speed: 250, // ms
  spread: 3.5,
  noise: 2.2,
  bands: 1,
};

export function hasStreamingClientQuery(req: DataQueryRequest<TestDataQuery>): boolean {
  return req.targets.some(query => query.scenarioId === 'streaming_client');
}

export function runStreams(req: DataQueryRequest<TestDataQuery>): Observable<DataQueryResponsePacket> {
  return merge(
    ...req.targets.map(query => {
      return runSignalStream(query, req);
    })
  );
}

export function runSignalStream(
  query: TestDataQuery,
  req: DataQueryRequest<TestDataQuery>
): Observable<DataQueryResponsePacket> {
  return new Observable<DataQueryResponsePacket>(subscriber => {
    setTimeout(() => {}, 10);
  });
}
