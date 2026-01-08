import { defaults } from 'lodash';
import { Observable, throwError } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';

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
  StreamingDataFrame,
  createDataFrame,
  addRow,
  getDisplayProcessor,
  createTheme,
} from '@grafana/data';
import { getBackendSrv } from '@grafana/runtime';

import { getRandomLine } from './LogIpsum';
import { TestDataDataQuery, StreamingQuery } from './dataquery';

export const defaultStreamQuery: StreamingQuery = {
  type: 'signal',
  speed: 250, // ms
  spread: 3.5,
  noise: 2.2,
  bands: 1,
};

export function runStream(
  target: TestDataDataQuery,
  req: DataQueryRequest<TestDataDataQuery>
): Observable<DataQueryResponse> {
  const query = defaults(target.stream, defaultStreamQuery);
  switch (query.type) {
    case 'signal':
      return runSignalStream(target, query, req);
    case 'logs':
      return runLogsStream(target, query, req);
    case 'fetch':
      return runFetchStream(target, query, req);
    case 'traces':
      return runTracesStream(target, query, req);
    case 'watch':
      return runWatchStream(target, query, req);
  }
  throw new Error(`Unknown Stream Type: ${query.type}`);
}

export function runSignalStream(
  target: TestDataDataQuery,
  query: StreamingQuery,
  req: DataQueryRequest<TestDataDataQuery>
): Observable<DataQueryResponse> {
  return new Observable<DataQueryResponse>((subscriber) => {
    const streamId = `signal-${req.panelId || 'explore'}-${target.refId}`;
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
    let time = Date.now() - maxDataPoints * speed;
    for (let i = 0; i < maxDataPoints; i++) {
      addNextRow(time);
      time += speed;
    }

    const pushNextEvent = () => {
      lastSent = Date.now();
      addNextRow(lastSent);
      subscriber.next({
        data: [frame],
        key: streamId,
        state: LoadingState.Streaming,
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
  target: TestDataDataQuery,
  query: StreamingQuery,
  req: DataQueryRequest<TestDataDataQuery>
): Observable<DataQueryResponse> {
  return new Observable<DataQueryResponse>((subscriber) => {
    const streamId = `logs-${req.panelId || 'explore'}-${target.refId}`;
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
        state: LoadingState.Streaming,
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

interface StreamMessage {
  message: number; // incrementing number
  time: number;
  value: number;
}

export function runWatchStream(
  target: TestDataDataQuery,
  query: StreamingQuery,
  req: DataQueryRequest<TestDataDataQuery>
): Observable<DataQueryResponse> {
  const uid = req.targets[0].datasource?.uid;
  if (!uid) {
    return throwError(() => new Error('expected datasource uid'));
  }

  return new Observable<DataQueryResponse>((subscriber) => {
    const streamId = `watch-${req.panelId || 'explore'}-${target.refId}`;
    const data = new CircularDataFrame({
      append: 'tail',
      capacity: req.maxDataPoints || 1000,
    });
    data.refId = target.refId;
    data.name = target.alias || 'Logs ' + target.refId;
    data.addField({ name: 'time', type: FieldType.time });
    data.addField({ name: 'message', type: FieldType.number });
    data.addField({ name: 'value', type: FieldType.number });
    const decoder = new TextDecoder();

    const sub = getBackendSrv()
      .chunked({
        url: `api/datasources/uid/${uid}/resources/stream`,
        params: {
          count: req.maxDataPoints || 1000, // connection will close when done
          format: 'json',
          speed: `${query.speed ?? 250}ms`,
          flush: 85, // 85% (eg, sometimes send a few at a time)
        },
      })
      .subscribe({
        next: (chunk) => {
          if (!chunk.data || !chunk.ok) {
            console.info('chunk missing data', chunk);
            return;
          }
          decoder
            .decode(chunk.data, { stream: true })
            .split('\n')
            .forEach((line) => {
              if (line?.length) {
                try {
                  const msg: StreamMessage = JSON.parse(line);

                  data.fields[0].values.push(msg.time);
                  data.fields[1].values.push(msg.message);
                  data.fields[2].values.push(msg.value);

                  subscriber.next({
                    data: [data],
                    key: streamId,
                    state: LoadingState.Streaming,
                  });
                } catch (err) {
                  console.warn('error parsing line', line, err);
                }
              }
            });
        },
        error: (err) => {
          console.warn('error in stream', streamId, err);
        },
        complete: () => {
          console.info('complete stream', streamId);
        },
      });

    return () => {
      console.log('unsubscribing to stream', streamId);
      sub.unsubscribe();
    };
  });
}

export function runFetchStream(
  target: TestDataDataQuery,
  query: StreamingQuery,
  req: DataQueryRequest<TestDataDataQuery>
): Observable<DataQueryResponse> {
  return new Observable<DataQueryResponse>((subscriber) => {
    const streamId = `fetch-${req.panelId || 'explore'}-${target.refId}`;
    const maxDataPoints = req.maxDataPoints || 1000;

    let data = new CircularDataFrame({
      append: 'tail',
      capacity: maxDataPoints,
    });
    data.refId = target.refId;
    data.name = target.alias || 'Fetch ' + target.refId;

    let reader: ReadableStreamDefaultReader<Uint8Array>;
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

    const processChunk = async (
      value: ReadableStreamReadResult<Uint8Array>
    ): Promise<ReadableStreamReadResult<Uint8Array> | undefined> => {
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

export function runTracesStream(
  target: TestDataDataQuery,
  query: StreamingQuery,
  req: DataQueryRequest<TestDataDataQuery>
): Observable<DataQueryResponse> {
  return new Observable<DataQueryResponse>((subscriber) => {
    const streamId = `traces-${req.panelId || 'explore'}-${target.refId}`;
    const data = createMainTraceFrame(target, req.maxDataPoints);
    let timeoutId: ReturnType<typeof setTimeout>;

    const pushNextEvent = () => {
      const subframe = createTraceSubFrame();
      addRow(subframe, [uuidv4(), Date.now(), 'Grafana', 1500]);
      addRow(data, [uuidv4(), Date.now(), 'Grafana', 'HTTP GET /explore', 1500, [subframe]]);

      subscriber.next({
        data: [data],
        key: streamId,
        state: LoadingState.Streaming,
      });

      timeoutId = setTimeout(pushNextEvent, query.speed);
    };

    // Send first event in 5ms
    setTimeout(pushNextEvent, 5);

    return () => {
      console.log('unsubscribing to stream ' + streamId);
      clearTimeout(timeoutId);
    };
  });
}

function createMainTraceFrame(target: TestDataDataQuery, maxDataPoints = 1000) {
  const data = new CircularDataFrame({
    append: 'head',
    capacity: maxDataPoints,
  });
  data.refId = target.refId;
  data.name = target.alias || 'Traces ' + target.refId;
  data.addField({ name: 'TraceID', type: FieldType.string });
  data.addField({ name: 'Start time', type: FieldType.time });
  data.addField({ name: 'Service', type: FieldType.string });
  data.addField({ name: 'Name', type: FieldType.string });
  data.addField({ name: 'Duration', type: FieldType.number, config: { unit: 'ms' } });
  data.addField({ name: 'nested', type: FieldType.nestedFrames });
  data.meta = {
    preferredVisualisationType: 'table',
    uniqueRowIdFields: [0],
  };
  return data;
}

function createTraceSubFrame() {
  const frame = createDataFrame({
    fields: [
      { name: 'SpanID', type: FieldType.string },
      { name: 'Start time', type: FieldType.time },
      { name: 'service.name', type: FieldType.string },
      { name: 'duration', type: FieldType.number },
    ],
  });

  // TODO: this should be removed later but right now there is an issue that applyFieldOverrides does not consider
  //  nested frames.
  for (const f of frame.fields) {
    f.display = getDisplayProcessor({ field: f, theme });
  }
  return frame;
}

const theme = createTheme();
