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
  DataFrameSchema,
  DataFrameData,
} from '@grafana/data';
import { liveTimer } from 'app/features/dashboard/dashgrid/liveTimer';
import { StreamingDataFrame } from 'app/features/live/data/StreamingDataFrame';

import { getRandomLine } from './LogIpsum';
import { TestData, StreamingQuery } from './dataquery.gen';

export const defaultStreamQuery: StreamingQuery = {
  type: 'signal',
  speed: 250, // ms
  spread: 3.5,
  noise: 2.2,
  bands: 1,
};

export function runStream(target: TestData, req: DataQueryRequest<TestData>): Observable<DataQueryResponse> {
  const query = defaults(target.stream, defaultStreamQuery);
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
  target: TestData,
  query: StreamingQuery,
  req: DataQueryRequest<TestData>
): Observable<DataQueryResponse> {
  return new Observable<DataQueryResponse>((subscriber) => {
    const streamId = `signal-${req.panelId}-${target.refId}`;
    const maxDataPoints = req.maxDataPoints || 1000;

    const schema: DataFrameSchema = {
      refId: target.refId,
      fields: [
        { name: 'time', type: FieldType.time },
        { name: target.alias ?? 'value', type: FieldType.number },
      ],
    };

    const { spread, speed, bands = 0, noise } = query;
    for (let i = 0; i < bands; i++) {
      const suffix = bands > 1 ? ` ${i + 1}` : '';
      schema.fields.push({ name: 'Min' + suffix, type: FieldType.number });
      schema.fields.push({ name: 'Max' + suffix, type: FieldType.number });
    }

    const frame = StreamingDataFrame.fromDataFrameJSON({ schema }, { maxLength: maxDataPoints });

    let value = Math.random() * 100;
    let timeoutId: ReturnType<typeof setTimeout>;
    let lastSent = -1;

    const addNextRow = (time: number) => {
      value += (Math.random() - 0.5) * spread;

      const data: DataFrameData = {
        values: [[time], [value]],
      };

      let min = value;
      let max = value;

      for (let i = 0; i < bands; i++) {
        min = min - Math.random() * noise;
        max = max + Math.random() * noise;

        data.values.push([min]);
        data.values.push([max]);
      }

      const event = { data };
      return frame.push(event);
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

      const elapsed = liveTimer.lastUpdate - lastSent;
      if (elapsed > 1000 || liveTimer.ok) {
        subscriber.next({
          data: [frame],
          key: streamId,
          state: LoadingState.Streaming,
        });
        lastSent = liveTimer.lastUpdate;
      }

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
  target: TestData,
  query: StreamingQuery,
  req: DataQueryRequest<TestData>
): Observable<DataQueryResponse> {
  return new Observable<DataQueryResponse>((subscriber) => {
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

    let timeoutId: ReturnType<typeof setTimeout>;

    const pushNextEvent = () => {
      data.fields[0].values.push(getRandomLine());
      data.fields[1].values.push(Date.now());

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
  target: TestData,
  query: StreamingQuery,
  req: DataQueryRequest<TestData>
): Observable<DataQueryResponse> {
  return new Observable<DataQueryResponse>((subscriber) => {
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
        onRow: (row) => {
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

    fetch(new Request(query.url)).then((response) => {
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
