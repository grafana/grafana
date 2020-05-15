import { defaults } from 'lodash';
import { Observable } from 'rxjs';

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

export const defaultQuery: StreamingQuery = {
  type: 'signal',
  speed: 250, // ms
  spread: 3.5,
  noise: 2.2,
  bands: 1,
};

export function runStream(target: TestDataQuery, req: DataQueryRequest<TestDataQuery>): Observable<DataQueryResponse> {
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
    data.addField({ name: 'time', type: FieldType.time });
    data.addField({ name: 'line', type: FieldType.string });

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
