import defaults from 'lodash/defaults';
import {
  DataQueryRequest,
  FieldType,
  SeriesData,
  DataQueryResponse,
  DataQueryError,
  SeriesDataStreamObserver,
  DataQueryStream,
  LoadingState,
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

  process(req: DataQueryRequest<TestDataQuery>, observer: SeriesDataStreamObserver): DataQueryResponse | undefined {
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
            resp.streams.push(existing);
            continue;
          }
          existing.shutdown();
          delete this.workers[key];
        }
        const type = query.stream.type;
        if (type === 'signal') {
          const worker = new SignalWorker(key, query, req, observer);
          resp.streams.push(worker);
          this.workers[key] = worker;
        } else if (type === 'logs') {
          const worker = new LogsWorker(key, query, req, observer);
          resp.streams.push(worker);
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
export class StreamWorker implements DataQueryStream {
  key: string;
  state = LoadingState.Streaming;
  series: SeriesData[];
  request: DataQueryRequest;

  query: StreamingQuery;
  observer: SeriesDataStreamObserver;
  last = -1;
  timeoutId = 0;

  constructor(key: string, query: TestDataQuery, request: DataQueryRequest, observer: SeriesDataStreamObserver) {
    this.key = key;
    this.query = query.stream;
    this.request = request;
    this.last = Date.now();
    this.observer = observer;
    this.series = [];
    console.log('Creating Test Stream: ', this);
  }

  shutdown = () => {
    this.observer = null;
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = 0;
    }
  };

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
    const { query, request } = this;
    const maxRows = query.buffer ? query.buffer : request.maxDataPoints;

    // Edit the first series
    const series = this.series[0];
    let rows = series.rows.concat(append);
    const extra = maxRows - rows.length;
    if (extra < 0) {
      rows = rows.slice(extra * -1);
    }
    series.rows = rows;

    // Broadcast the changes
    if (this.observer) {
      this.observer.next(this);
    }
    this.last = Date.now();
  }
}

export class SignalWorker extends StreamWorker {
  value: number;

  constructor(key: string, query: TestDataQuery, request: DataQueryRequest, observer: SeriesDataStreamObserver) {
    super(key, query, request, observer);
    window.setTimeout(() => {
      this.series = [this.initBuffer(query.refId)];
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

  constructor(key: string, query: TestDataQuery, request: DataQueryRequest, observer: SeriesDataStreamObserver) {
    super(key, query, request, observer);

    window.setTimeout(() => {
      this.series = [this.initBuffer(query.refId)];
      this.looper();
    }, 10);
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
