import { defaults } from 'lodash';
import { Observable } from 'rxjs';
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
  switch (query.type) {
    case 'signal':
      return runSignalStream(target, query, req);
    case 'logs':
      return runLogsStream(target, query, req);
    case 'fetch':
      return runFetchStream(target, query, req);
    case 'traces':
      return runTracesStream(target, query, req);
  }
  throw new Error(`Unknown Stream Type: ${query.type}`);
}

export function runSignalStream(
  target: TestData,
  query: StreamingQuery,
  req: DataQueryRequest<TestData>
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
    if (true) {
      let time = Date.now() - maxDataPoints * speed;
      for (let i = 0; i < maxDataPoints; i++) {
        addNextRow(time);
        time += speed;
      }
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
  target: TestData,
  query: StreamingQuery,
  req: DataQueryRequest<TestData>
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

export function runFetchStream(
  target: TestData,
  query: StreamingQuery,
  req: DataQueryRequest<TestData>
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

export function runTracesStream(
  target: TestData,
  query: StreamingQuery,
  req: DataQueryRequest<TestData>
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

function createMainTraceFrame(target: TestData, maxDataPoints = 1000) {
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
