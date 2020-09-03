import { defaults } from 'lodash';
import { Observable, partition, merge, of } from 'rxjs';
import { map, tap, mergeMap, catchError, delay } from 'rxjs/operators';

import {
  DataQueryRequest,
  DataQueryResponse,
  FieldType,
  CircularDataFrame,
  CSVReader,
  Field,
  LoadingState,
} from '@grafana/data';

import { TestDataQuery, StreamingQuery } from './types';
import { getRandomLine } from './LogIpsum';
import { getBackendSrv, toDataQueryResponse } from '@grafana/runtime';

export const defaultQuery: StreamingQuery = {
  type: 'signal',
  speed: 250, // ms
  spread: 3.5,
  noise: 2.2,
  bands: 1,
};

export function runStream(
  target: TestDataQuery,
  req: DataQueryRequest<TestDataQuery>,
  datasourceId: number
): Observable<DataQueryResponse> {
  const query = defaults(target.stream, defaultQuery);
  if ('signal' === query.type) {
    return runSignalStream(target, query, req);
  }
  if ('logs' === query.type) {
    return runLogsStream(target, query, req);
  }
  if ('fetch' === query.type) {
    return runFetchStream(target, query, req);
  }
  if ('fetch2' === query.type) {
    return getNextRequest(req, datasourceId);
  }
  throw new Error(`Unknown Stream Type: ${query.type}`);
}

export function runSignalStream(
  target: TestDataQuery,
  query: StreamingQuery,
  req: DataQueryRequest<TestDataQuery>
): Observable<DataQueryResponse> {
  return new Observable<DataQueryResponse>(subscriber => {
    const streamId = `signal-${req.panelId}-${target.refId}`;
    const maxDataPoints = req.maxDataPoints || 1000;

    const data = new CircularDataFrame({
      append: 'tail',
      capacity: maxDataPoints,
    });
    data.refId = target.refId;
    data.name = target.alias || 'Signal ' + target.refId;
    data.addField({ name: 'time', type: FieldType.time });
    data.addField({ name: 'value', type: FieldType.number });

    const { spread, speed, bands = 0, noise } = query;

    for (let i = 0; i < bands; i++) {
      const suffix = bands > 1 ? ` ${i + 1}` : '';
      data.addField({ name: 'Min' + suffix, type: FieldType.number });
      data.addField({ name: 'Max' + suffix, type: FieldType.number });
    }

    let value = Math.random() * 100;
    let timeoutId: any = null;

    const addNextRow = (time: number) => {
      value += (Math.random() - 0.5) * spread;

      let idx = 0;
      data.fields[idx++].values.add(time);
      data.fields[idx++].values.add(value);

      let min = value;
      let max = value;

      for (let i = 0; i < bands; i++) {
        min = min - Math.random() * noise;
        max = max + Math.random() * noise;

        data.fields[idx++].values.add(min);
        data.fields[idx++].values.add(max);
      }
    };

    // Fill the buffer on init
    if (true) {
      let time = Date.now() - maxDataPoints * speed;
      for (let i = 0; i < maxDataPoints; i++) {
        addNextRow(time);
        time += speed;
      }
    }

    const pushNextEvent = () => {
      addNextRow(Date.now());
      subscriber.next({
        data: [data],
        key: streamId,
      });

      timeoutId = setTimeout(pushNextEvent, speed);
    };

    // Send first event in 5ms
    setTimeout(pushNextEvent, 5);

    return () => {
      console.log('unsubscribing to stream ' + streamId);
      clearTimeout(timeoutId);
    };
  });
}

export function runLogsStream(
  target: TestDataQuery,
  query: StreamingQuery,
  req: DataQueryRequest<TestDataQuery>
): Observable<DataQueryResponse> {
  return new Observable<DataQueryResponse>(subscriber => {
    const streamId = `logs-${req.panelId}-${target.refId}`;
    const maxDataPoints = req.maxDataPoints || 1000;

    const data = new CircularDataFrame({
      append: 'tail',
      capacity: maxDataPoints,
    });
    data.refId = target.refId;
    data.name = target.alias || 'Logs ' + target.refId;
    data.addField({ name: 'line', type: FieldType.string });
    data.addField({ name: 'time', type: FieldType.time });
    data.meta = { preferredVisualisationType: 'logs' };

    const { speed } = query;

    let timeoutId: any = null;

    const pushNextEvent = () => {
      data.values.time.add(Date.now());
      data.values.line.add(getRandomLine());

      subscriber.next({
        data: [data],
        key: streamId,
      });

      timeoutId = setTimeout(pushNextEvent, speed);
    };

    // Send first event in 5ms
    setTimeout(pushNextEvent, 5);

    return () => {
      console.log('unsubscribing to stream ' + streamId);
      clearTimeout(timeoutId);
    };
  });
}

export function runFetchStream(
  target: TestDataQuery,
  query: StreamingQuery,
  req: DataQueryRequest<TestDataQuery>
): Observable<DataQueryResponse> {
  return new Observable<DataQueryResponse>(subscriber => {
    const streamId = `fetch-${req.panelId}-${target.refId}`;
    const maxDataPoints = req.maxDataPoints || 1000;

    let data = new CircularDataFrame({
      append: 'tail',
      capacity: maxDataPoints,
    });
    data.refId = target.refId;
    data.name = target.alias || 'Fetch ' + target.refId;

    let reader: ReadableStreamReader<Uint8Array>;
    const csv = new CSVReader({
      callback: {
        onHeader: (fields: Field[]) => {
          // Clear any existing fields
          if (data.fields.length) {
            data = new CircularDataFrame({
              append: 'tail',
              capacity: maxDataPoints,
            });
            data.refId = target.refId;
            data.name = 'Fetch ' + target.refId;
          }
          for (const field of fields) {
            data.addField(field);
          }
        },
        onRow: (row: any[]) => {
          data.add(row);
        },
      },
    });

    const processChunk = (value: ReadableStreamReadResult<Uint8Array>): any => {
      if (value.value) {
        const text = new TextDecoder().decode(value.value);
        csv.readCSV(text);
      }

      subscriber.next({
        data: [data],
        key: streamId,
        state: value.done ? LoadingState.Done : LoadingState.Streaming,
      });

      if (value.done) {
        console.log('Finished stream');
        subscriber.complete(); // necessary?
        return;
      }

      return reader.read().then(processChunk);
    };

    if (!query.url) {
      throw new Error('query.url is not defined');
    }

    fetch(new Request(query.url)).then(response => {
      if (response.body) {
        reader = response.body.getReader();
        reader.read().then(processChunk);
      }
    });

    return () => {
      // Cancel fetch?
      console.log('unsubscribing to stream ' + streamId);
    };
  });
}

export function runFetch2Stream(
  req: DataQueryRequest<TestDataQuery>,
  datasourceId: number
): Observable<DataQueryResponse> {
  const to = Date.now();
  return getBackendSrv().fetch({
    url: '/api/tsdb/query',
    method: 'POST',
    data: {
      to: `${to}`,
      from: `${to - 6000}`,
      queries: [{ ...req, datasourceId, refId: 'A', scenarioId: 'random_walk' }],
    },
  });
}

const getNextRequest = (req: DataQueryRequest<TestDataQuery>, datasourceId: number): Observable<DataQueryResponse> => {
  return new Observable<DataQueryResponse>(subscriber => {
    const now = Date.now();
    console.log('Start new request', now);
    const responseStream = getBackendSrv()
      .fetch({
        url: '/api/tsdb/query',
        method: 'POST',
        data: {
          to: `${now}`,
          from: `${now - 6000}`,
          queries: [{ ...req, datasourceId, refId: 'A', scenarioId: 'random_walk' }],
        },
      })
      .pipe(
        map((rsp: any) => {
          return toDataQueryResponse(rsp);
        }),
        catchError(err => {
          return of(toDataQueryResponse(err));
        })
      );

    const [continueStream, completeStream] = partition(responseStream, ({ state }) => state !== LoadingState.Error);
    const result = merge(
      completeStream.pipe(
        map(response => {
          console.log('DONE (had an error)');
          return response; // no change
        })
      ),
      continueStream.pipe(
        tap(response => subscriber.next({ ...response, state: LoadingState.Streaming })), // send the current resutls to the panel
        delay(1000), // wait a sec...
        mergeMap(response => {
          // Go make another request!
          return getNextRequest(req, datasourceId);
        })
      )
    ).subscribe(subscriber);

    return () => {
      console.log('unsubscribed...');
      result.unsubscribe();
    };
  });
};
