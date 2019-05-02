import defaults from 'lodash/defaults';
import {
  DataQueryRequest,
  FieldType,
  SeriesData,
  DataQueryResponse,
  DataQueryError,
  DataStreamObserver,
  DataStreamState,
  LoadingState,
  LogLevel,
} from '@grafana/ui';
import { TestDataQuery, StreamingQuery } from './types';

export const defaultQuery: StreamingQuery = {
  type: 'signal',
  speed: 250, // ms
  spread: 3.5,
  noise: 2.2,
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
      const key = req.dashboardId + '/' + req.panelId + '/' + query.refId;

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
  query: StreamingQuery;
  stream: DataStreamState;
  observer: DataStreamObserver;
  last = -1;
  timeoutId = 0;

  constructor(key: string, query: TestDataQuery, request: DataQueryRequest, observer: DataStreamObserver) {
    this.stream = {
      key,
      state: LoadingState.Streaming,
      request,
      unsubscribe: this.unsubscribe,
    };
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
    console.log('Reuse Test Stream: ', this);
    return true;
  }

  appendRows(append: any[][]) {
    // Trim the maximum row count
    const { query, stream } = this;
    const maxRows = query.buffer ? query.buffer : stream.request.maxDataPoints;

    // Edit the first series
    const series = stream.series[0];
    let rows = series.rows.concat(append);
    const extra = maxRows - rows.length;
    if (extra < 0) {
      rows = rows.slice(extra * -1);
    }
    series.rows = rows;

    // Tell the event about only the rows that changed (it may want to process them)
    stream.delta = [{ ...series, rows: append }];

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

  constructor(key: string, query: TestDataQuery, request: DataQueryRequest, observer: DataStreamObserver) {
    super(key, query, request, observer);
    setTimeout(() => {
      this.stream.series = [this.initBuffer(query.refId)];
      this.looper();
    }, 10);
  }

  nextRow = (time: number) => {
    const { spread, noise } = this.query;
    this.value += (Math.random() - 0.5) * spread;
    return [
      time,
      this.value, // Value
      this.value - Math.random() * noise, // MIN
      this.value + Math.random() * noise, // MAX
    ];
  };

  initBuffer(refId: string): SeriesData {
    const { speed, buffer } = this.query;
    const data = {
      fields: [
        { name: 'Time', type: FieldType.time },
        { name: 'Value', type: FieldType.number },
        { name: 'Min', type: FieldType.number },
        { name: 'Max', type: FieldType.number },
      ],
      rows: [],
      refId,
      name: 'Signal ' + refId,
    } as SeriesData;

    const request = this.stream.request;

    this.value = Math.random() * 100;
    const maxRows = buffer ? buffer : request.maxDataPoints;
    let time = Date.now() - maxRows * speed;
    for (let i = 0; i < maxRows; i++) {
      data.rows.push(this.nextRow(time));
      time += speed;
    }
    return data;
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

export class LogsWorker extends StreamWorker {
  index = 0;

  constructor(key: string, query: TestDataQuery, request: DataQueryRequest, observer: DataStreamObserver) {
    super(key, query, request, observer);

    window.setTimeout(() => {
      this.stream.series = [this.initBuffer(query.refId)];
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

  initBuffer(refId: string): SeriesData {
    const { speed, buffer } = this.query;
    const data = {
      fields: [{ name: 'Time', type: FieldType.time }, { name: 'Line', type: FieldType.string }],
      rows: [],
      refId,
      name: 'Logs ' + refId,
    } as SeriesData;

    const request = this.stream.request;

    const maxRows = buffer ? buffer : request.maxDataPoints;
    let time = Date.now() - maxRows * speed;
    for (let i = 0; i < maxRows; i++) {
      data.rows.push(this.nextRow(time));
      time += speed;
    }
    return data;
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
