import defaults from 'lodash/defaults';
import {
  DataQueryRequest,
  DataQueryResponse,
  DataQueryError,
  DataStreamObserver,
  DataStreamState,
  FieldType,
  Field,
  LoadingState,
  LogLevel,
  CSVReader,
  MutableDataFrame,
  CircularVector,
  DataFrame,
} from '@grafana/data';
import { TestDataQuery, StreamingQuery } from './types';

export const defaultQuery: StreamingQuery = {
  type: 'signal',
  speed: 250, // ms
  spread: 3.5,
  noise: 2.2,
  bands: 1,
};

type StreamWorkers = {
  [key: string]: StreamWorker;
};

export class StreamHandler {
  workers: StreamWorkers = {};

  process(req: DataQueryRequest<TestDataQuery>, observer: DataStreamObserver): DataQueryResponse | undefined {
    let resp: DataQueryResponse;

    for (const query of req.targets) {
      if ('streaming_client' !== query.scenarioId) {
        continue;
      }

      if (!resp) {
        resp = { data: [] };
      }

      // set stream option defaults
      query.stream = defaults(query.stream, defaultQuery);
      // create stream key
      const key = req.dashboardId + '/' + req.panelId + '/' + query.refId + '@' + query.stream.bands;

      if (this.workers[key]) {
        const existing = this.workers[key];
        if (existing.update(query, req)) {
          continue;
        }
        existing.unsubscribe();
        delete this.workers[key];
      }

      const type = query.stream.type;
      if (type === 'signal') {
        this.workers[key] = new SignalWorker(key, query, req, observer);
      } else if (type === 'logs') {
        this.workers[key] = new LogsWorker(key, query, req, observer);
      } else if (type === 'fetch') {
        this.workers[key] = new FetchWorker(key, query, req, observer);
      } else {
        throw {
          message: 'Unknown Stream type: ' + type,
          refId: query.refId,
        } as DataQueryError;
      }
    }
    return resp;
  }
}

/**
 * Manages a single stream request
 */
export class StreamWorker {
  refId: string;
  query: StreamingQuery;
  stream: DataStreamState;
  observer: DataStreamObserver;
  last = -1;
  timeoutId = 0;

  // The values within
  values: CircularVector[] = [];
  data: DataFrame = { fields: [], length: 0 };

  constructor(key: string, query: TestDataQuery, request: DataQueryRequest, observer: DataStreamObserver) {
    this.stream = {
      key,
      state: LoadingState.Streaming,
      request,
      unsubscribe: this.unsubscribe,
    };
    this.refId = query.refId;
    this.query = query.stream;
    this.last = Date.now();
    this.observer = observer;
    console.log('Creating Test Stream: ', this);
  }

  unsubscribe = () => {
    this.observer = null;
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = 0;
    }
  };

  update(query: TestDataQuery, request: DataQueryRequest): boolean {
    // Check if stream has been unsubscribed or query changed type
    if (this.observer === null || this.query.type !== query.stream.type) {
      return false;
    }
    this.query = query.stream;
    this.stream.request = request; // OK?
    return true;
  }

  appendRows(append: any[][]) {
    // Trim the maximum row count
    const { stream, values, data } = this;

    // Append all rows
    for (let i = 0; i < append.length; i++) {
      const row = append[i];
      for (let j = 0; j < values.length; j++) {
        values[j].add(row[j]); // Circular buffer will kick out old entries
      }
    }
    // Clear any cached values
    for (let j = 0; j < data.fields.length; j++) {
      data.fields[j].calcs = undefined;
    }
    stream.data = [data];

    // Broadcast the changes
    if (this.observer) {
      this.observer(stream);
    } else {
      console.log('StreamWorker working without any observer');
    }

    this.last = Date.now();
  }
}

export class SignalWorker extends StreamWorker {
  value: number;

  bands = 1;

  constructor(key: string, query: TestDataQuery, request: DataQueryRequest, observer: DataStreamObserver) {
    super(key, query, request, observer);
    setTimeout(() => {
      this.initBuffer(query.refId);
      this.looper();
    }, 10);

    this.bands = query.stream.bands ? query.stream.bands : 0;
  }

  nextRow = (time: number) => {
    const { spread, noise } = this.query;
    this.value += (Math.random() - 0.5) * spread;
    const row = [time, this.value];
    for (let i = 0; i < this.bands; i++) {
      const v = row[row.length - 1];
      row.push(v - Math.random() * noise); // MIN
      row.push(v + Math.random() * noise); // MAX
    }
    return row;
  };

  initBuffer(refId: string) {
    const { speed } = this.query;
    const request = this.stream.request;
    const maxRows = request.maxDataPoints || 1000;
    const times = new CircularVector({ capacity: maxRows });
    const vals = new CircularVector({ capacity: maxRows });
    this.values = [times, vals];

    const data = new MutableDataFrame({
      fields: [
        { name: 'Time', type: FieldType.time, values: times }, // The time field
        { name: 'Value', type: FieldType.number, values: vals },
      ],
      refId,
      name: 'Signal ' + refId,
    });

    for (let i = 0; i < this.bands; i++) {
      const suffix = this.bands > 1 ? ` ${i + 1}` : '';
      const min = new CircularVector({ capacity: maxRows });
      const max = new CircularVector({ capacity: maxRows });
      this.values.push(min);
      this.values.push(max);

      data.addField({ name: 'Min' + suffix, type: FieldType.number, values: min });
      data.addField({ name: 'Max' + suffix, type: FieldType.number, values: max });
    }

    console.log('START', data);

    this.value = Math.random() * 100;
    let time = Date.now() - maxRows * speed;
    for (let i = 0; i < maxRows; i++) {
      const row = this.nextRow(time);
      for (let j = 0; j < this.values.length; j++) {
        this.values[j].add(row[j]);
      }
      time += speed;
    }
    this.data = data;
  }

  looper = () => {
    if (!this.observer) {
      const request = this.stream.request;
      const elapsed = request.startTime - Date.now();
      if (elapsed > 1000) {
        console.log('Stop looping');
        return;
      }
    }

    // Make sure it has a minimum speed
    const { query } = this;
    if (query.speed < 5) {
      query.speed = 5;
    }

    this.appendRows([this.nextRow(Date.now())]);
    this.timeoutId = window.setTimeout(this.looper, query.speed);
  };
}

export class FetchWorker extends StreamWorker {
  csv: CSVReader;
  reader: ReadableStreamReader<Uint8Array>;

  constructor(key: string, query: TestDataQuery, request: DataQueryRequest, observer: DataStreamObserver) {
    super(key, query, request, observer);
    if (!query.stream.url) {
      throw new Error('Missing Fetch URL');
    }
    if (!query.stream.url.startsWith('http')) {
      throw new Error('Fetch URL must be absolute');
    }

    this.csv = new CSVReader({ callback: this });
    fetch(new Request(query.stream.url)).then(response => {
      this.reader = response.body.getReader();
      this.reader.read().then(this.processChunk);
    });
  }

  processChunk = (value: ReadableStreamReadResult<Uint8Array>): any => {
    if (this.observer == null) {
      return; // Nothing more to do
    }

    if (value.value) {
      const text = new TextDecoder().decode(value.value);
      this.csv.readCSV(text);
    }

    if (value.done) {
      console.log('Finished stream');
      this.stream.state = LoadingState.Done;
      return;
    }

    return this.reader.read().then(this.processChunk);
  };

  onHeader = (fields: Field[]) => {
    console.warn('TODO!!!', fields);
    // series.refId = this.refId;
    // this.stream.data = [series];
  };

  onRow = (row: any[]) => {
    // TODO?? this will send an event for each row, even if the chunk passed a bunch of them
    this.appendRows([row]);
  };
}

export class LogsWorker extends StreamWorker {
  index = 0;

  constructor(key: string, query: TestDataQuery, request: DataQueryRequest, observer: DataStreamObserver) {
    super(key, query, request, observer);

    window.setTimeout(() => {
      this.initBuffer(query.refId);
      this.looper();
    }, 10);
  }

  getRandomLogLevel(): LogLevel {
    const v = Math.random();
    if (v > 0.9) {
      return LogLevel.critical;
    }
    if (v > 0.8) {
      return LogLevel.error;
    }
    if (v > 0.7) {
      return LogLevel.warning;
    }
    if (v > 0.4) {
      return LogLevel.info;
    }
    if (v > 0.3) {
      return LogLevel.debug;
    }
    if (v > 0.1) {
      return LogLevel.trace;
    }
    return LogLevel.unknown;
  }

  getNextWord() {
    this.index = (this.index + Math.floor(Math.random() * 5)) % words.length;
    return words[this.index];
  }

  getRandomLine(length = 60) {
    let line = this.getNextWord();
    while (line.length < length) {
      line += ' ' + this.getNextWord();
    }
    return line;
  }

  nextRow = (time: number) => {
    return [time, '[' + this.getRandomLogLevel() + '] ' + this.getRandomLine()];
  };

  initBuffer(refId: string) {
    const { speed } = this.query;

    const request = this.stream.request;

    const maxRows = request.maxDataPoints || 1000;

    const times = new CircularVector({ capacity: maxRows });
    const lines = new CircularVector({ capacity: maxRows });

    this.values = [times, lines];
    this.data = new MutableDataFrame({
      fields: [
        { name: 'Time', type: FieldType.time, values: times },
        { name: 'Line', type: FieldType.string, values: lines },
      ],
      refId,
      name: 'Logs ' + refId,
    });

    // Fill up the buffer
    let time = Date.now() - maxRows * speed;
    for (let i = 0; i < maxRows; i++) {
      const row = this.nextRow(time);
      times.add(row[0]);
      lines.add(row[1]);
      time += speed;
    }
  }

  looper = () => {
    if (!this.observer) {
      const request = this.stream.request;
      const elapsed = request.startTime - Date.now();
      if (elapsed > 1000) {
        console.log('Stop looping');
        return;
      }
    }

    // Make sure it has a minimum speed
    const { query } = this;
    if (query.speed < 5) {
      query.speed = 5;
    }
    const variance = query.speed * 0.2 * (Math.random() - 0.5); // +-10%

    this.appendRows([this.nextRow(Date.now())]);
    this.timeoutId = window.setTimeout(this.looper, query.speed + variance);
  };
}

const words = [
  'At',
  'vero',
  'eos',
  'et',
  'accusamus',
  'et',
  'iusto',
  'odio',
  'dignissimos',
  'ducimus',
  'qui',
  'blanditiis',
  'praesentium',
  'voluptatum',
  'deleniti',
  'atque',
  'corrupti',
  'quos',
  'dolores',
  'et',
  'quas',
  'molestias',
  'excepturi',
  'sint',
  'occaecati',
  'cupiditate',
  'non',
  'provident',
  'similique',
  'sunt',
  'in',
  'culpa',
  'qui',
  'officia',
  'deserunt',
  'mollitia',
  'animi',
  'id',
  'est',
  'laborum',
  'et',
  'dolorum',
  'fuga',
  'Et',
  'harum',
  'quidem',
  'rerum',
  'facilis',
  'est',
  'et',
  'expedita',
  'distinctio',
  'Nam',
  'libero',
  'tempore',
  'cum',
  'soluta',
  'nobis',
  'est',
  'eligendi',
  'optio',
  'cumque',
  'nihil',
  'impedit',
  'quo',
  'minus',
  'id',
  'quod',
  'maxime',
  'placeat',
  'facere',
  'possimus',
  'omnis',
  'voluptas',
  'assumenda',
  'est',
  'omnis',
  'dolor',
  'repellendus',
  'Temporibus',
  'autem',
  'quibusdam',
  'et',
  'aut',
  'officiis',
  'debitis',
  'aut',
  'rerum',
  'necessitatibus',
  'saepe',
  'eveniet',
  'ut',
  'et',
  'voluptates',
  'repudiandae',
  'sint',
  'et',
  'molestiae',
  'non',
  'recusandae',
  'Itaque',
  'earum',
  'rerum',
  'hic',
  'tenetur',
  'a',
  'sapiente',
  'delectus',
  'ut',
  'aut',
  'reiciendis',
  'voluptatibus',
  'maiores',
  'alias',
  'consequatur',
  'aut',
  'perferendis',
  'doloribus',
  'asperiores',
  'repellat',
];
