import { defaults } from 'lodash';
import { Observable, merge } from 'rxjs';
// import { map } from 'rxjs/operators';

import { DataQueryRequest, DataQueryResponse } from '@grafana/ui';

import { FieldType, CircularVector, MutableDataFrame } from '@grafana/data';

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

export function runStreams(
  queries: TestDataQuery[],
  req: DataQueryRequest<TestDataQuery>
): Observable<DataQueryResponse> {
  return merge(
    ...queries.map(query => {
      return runSignalStream(query, req);
    })
  );
}

export function runSignalStream(
  query: TestDataQuery,
  req: DataQueryRequest<TestDataQuery>
): Observable<DataQueryResponse> {
  return new Observable<DataQueryResponse>(subscriber => {
    const streamId = `panel-${req.panelId}-refId-${query.refId}`;
    const maxDataPoints = query.stream.buffer || req.maxDataPoints;

    const data = new MutableDataFrame(
      {
        refId: query.refId,
        name: 'Signal ' + query.refId,
        fields: [
          { name: 'time', type: FieldType.time, values: [] },
          { name: 'value', type: FieldType.number, values: [] },
        ],
      },
      (buffer: any[]) => {
        return new CircularVector({
          append: 'tail',
          capacity: maxDataPoints,
        });
      }
    );

    const streamQuery = defaults(query.stream, defaultQuery);
    const spread = streamQuery.spread;
    const speed = streamQuery.speed;

    let value = Math.random() * 100;
    let timeoutId: any = null;

    const pushNextValue = () => {
      data.add({
        time: Date.now(),
        value: value,
      });

      value += (Math.random() - 0.5) * spread;

      subscriber.next({
        data: [data],
        key: streamId,
      });

      timeoutId = setTimeout(pushNextValue, speed);
    };

    setTimeout(pushNextValue, 10);

    return () => {
      console.log('unsubscribing to stream ' + streamId);
      clearTimeout(timeoutId);
    };
  });
}
