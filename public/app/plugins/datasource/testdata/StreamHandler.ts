import defaults from 'lodash/defaults';
import {
  DataQueryRequest,
  FieldType,
  SeriesData,
  DataQueryResponse,
  DataQueryError,
  SeriesDataStream,
  SeriesDataStreamObserver,
} from '@grafana/ui';
import { TestDataQuery, StreamingQuery } from './types';
import { Unsubscribable } from 'rxjs';

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

  process(req: DataQueryRequest<TestDataQuery>): DataQueryResponse | undefined {
    let resp: DataQueryResponse;
    for (const query of req.targets) {
      if ('streaming_client' === query.scenarioId) {
        if (!resp) {
          resp = { data: [], streams: [] };
        }
        query.stream = defaults(query.stream, defaultQuery);

        const key = req.dashboardId + '/' + req.panelId + '/' + query.refId;
        if (this.workers[key]) {
          const existing = this.workers[key];
          if (existing.update(query, req)) {
            resp.streams.push(existing.stream);
            continue;
          }
          existing.stop();
          delete this.workers[key];
        }
        const type = query.stream.type;
        if (type === 'signal') {
          const worker = new SignalWorker(key, query, req);
          resp.streams.push(worker.stream);
          this.workers[key] = worker;
        } else if (type === 'logs') {
          const worker = new LogsWorker(key, query, req);
          resp.streams.push(worker.stream);
          this.workers[key] = worker;
        } else {
          throw {
            message: 'Unknown Stream type: ' + type,
            refId: query.refId,
          } as DataQueryError;
        }
      }
    }
    return resp;
  }
}

/**
 * Manages a single stream request
 */
export class StreamWorker implements Unsubscribable {
  stream: SeriesDataStream;
  series: SeriesData;
  query: StreamingQuery;
  request: DataQueryRequest;
  observer: SeriesDataStreamObserver;
  last = -1;
  timeoutId = 0;

  constructor(key: string, query: TestDataQuery, request: DataQueryRequest) {
    this.query = query.stream;
    this.request = request;
    this.last = Date.now();
    this.stream = {
      key,
      refId: query.refId,
      subscribe: this.subscribe,
    };
    console.log('Creating Test Stream: ', this);
  }

  private subscribe = (observer: SeriesDataStreamObserver): Unsubscribable => {
    if (this.observer) {
      throw {
        refId: this.stream.refId,
        message: 'Only one subscriber is allowed at a time',
      } as DataQueryError;
    }
    this.observer = observer;
    setTimeout(this.onSubscribe.bind(this), 5);
    return this;
  };

  onSubscribe() {
    // Allow subclasses to start sending
  }

  stop() {
    if (this.observer) {
      this.observer.done(this.stream.key);
      this.observer = null;
    }
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = 0;
    }
  }

  unsubscribe() {
    if (!this.observer) {
      throw new Error('Not listening to: ' + this.stream.refId);
    }
    this.observer = null;
  }

  update(query: TestDataQuery, request: DataQueryRequest): boolean {
    if (this.query.type !== query.stream.type) {
      return false;
    }
    this.request = request;
    this.query = query.stream;
    console.log('Reuse Test Stream: ', this);
    return true;
  }

  appendRows(append: any[][]) {
    // Trim the maximum row count
    const { series, query, request } = this;
    const maxRows = query.buffer ? query.buffer : request.maxDataPoints;

    let rows = series.rows.concat(append);
    const extra = maxRows - rows.length;
    if (extra < 0) {
      rows = rows.slice(extra * -1);
    }
    series.rows = rows;

    // Broadcast the changes
    if (this.observer) {
      if (!this.observer.next(this.stream.key, [series])) {
        this.stop();
        return;
      }
    }
    this.last = Date.now();
  }
}

export class SignalWorker extends StreamWorker {
  value: number;

  constructor(key: string, query: TestDataQuery, request: DataQueryRequest) {
    super(key, query, request);
  }

  onSubscribe() {
    this.series = this.initBuffer(this.stream.refId);
    this.looper(); // Start looping
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

    if (this.request) {
      data.meta = {
        request: this.request.requestId,
      };
    }

    this.value = Math.random() * 100;
    const maxRows = buffer ? buffer : this.request.maxDataPoints;
    let time = Date.now() - maxRows * speed;
    for (let i = 0; i < maxRows; i++) {
      data.rows.push(this.nextRow(time));
      time += speed;
    }
    return data;
  }

  looper = () => {
    if (!this.observer) {
      const elapsed = this.request.startTime - Date.now();
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

  constructor(key: string, query: TestDataQuery, request: DataQueryRequest) {
    super(key, query, request);
  }

  onSubscribe() {
    this.series = this.initBuffer(this.stream.refId);
    this.looper(); // Start looping
  }

  getNextWord() {
    this.index = (this.index + Math.floor(Math.random() * 5)) % words.length;
    return words[this.index];
  }

  getRandomLine() {
    let line = this.getNextWord();
    while (line.length < 80) {
      line += ' ' + this.getNextWord();
    }
    return line;
  }

  nextRow = (time: number) => {
    return [time, this.getRandomLine()];
  };

  initBuffer(refId: string): SeriesData {
    const { speed, buffer } = this.query;
    const data = {
      fields: [{ name: 'Time', type: FieldType.time }, { name: 'Line', type: FieldType.string }],
      rows: [],
      refId,
      name: 'Logs ' + refId,
    } as SeriesData;

    if (this.request) {
      data.meta = {
        request: this.request.requestId,
      };
    }

    const maxRows = buffer ? buffer : this.request.maxDataPoints;
    let time = Date.now() - maxRows * speed;
    for (let i = 0; i < maxRows; i++) {
      data.rows.push(this.nextRow(time));
      time += speed;
    }
    return data;
  }

  looper = () => {
    if (!this.observer) {
      const elapsed = this.request.startTime - Date.now();
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
