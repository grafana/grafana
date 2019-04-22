import _ from 'lodash';
import {
  DataQueryRequest,
  FieldType,
  SeriesData,
  DataQueryResponse,
  LoadingState,
  DataQueryError,
  SeriesDataStream,
} from '@grafana/ui';
import { TestDataQuery, StreamingQuery } from './types';
import { Subject } from 'rxjs';

const defaultQuery: StreamingQuery = {
  type: 'signal',
  speed: 50,
  spread: 3.5,
  noise: 0.9,
  buffer: 100, // 100 points
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
        query.stream = _.defaults(query.stream, defaultQuery);

        const key = req.dashboardId + '/' + req.panelId + '/' + query.refId;
        if (this.workers[key]) {
          const existing = this.workers[key];
          if (existing.update(query, req)) {
            resp.data.push(existing.series);
            continue;
          }
          existing.stop();
          delete this.workers[key];
        }
        const type = query.stream.type;
        if (type === 'signal') {
          const worker = new SignalWorker(query, req);
          resp.data.push(worker.series);
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
export class StreamWorker {
  stream: SeriesDataStream;
  series: SeriesData;
  query: StreamingQuery;
  request: DataQueryRequest;
  subject = new Subject<SeriesData>();
  state: LoadingState;
  last: number;

  constructor(query: TestDataQuery, request: DataQueryRequest) {
    this.query = query.stream;
    this.request = request;
    this.last = Date.now();
    this.stream = {
      refId: query.refId,
      subscription: this.subject,
    };
    console.log('Creating Test Stream: ', this.query);
  }

  update(query: TestDataQuery, request: DataQueryRequest): boolean {
    if (this.query.type !== query.stream.type) {
      return false;
    }
    this.query = query.stream;
    console.log('Reuse Test Stream: ', this);
    return true;
  }

  stop() {
    this.subject.complete();
    this.state = LoadingState.Done;
  }

  appendRows(append: any[]) {
    // Trim the maximum row count
    const { series, query } = this;
    let rows = series.rows.concat(append);
    const extra = query.buffer - rows.length;
    if (extra < 0) {
      rows = rows.slice(extra * -1);
    }
    series.rows = rows;

    // Broadcast the changes
    this.subject.next(series);
    this.last = Date.now();
  }
}

export class SignalWorker extends StreamWorker {
  value: number;

  constructor(query: TestDataQuery, request: DataQueryRequest) {
    super(query, request);

    this.series = this.initBuffer(query.refId);
    this.looper();
  }

  nextRow = (time: number) => {
    const { spread, noise } = this.query;
    this.value += (Math.random() - 0.5) * spread;
    return [time, this.value, this.value - Math.random() * noise, this.value + Math.random() * noise];
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
    let time = Date.now() - buffer * speed;
    for (let i = 0; i < buffer; i++) {
      data.rows.push(this.nextRow(time));
      time += speed;
    }
    return data;
  }

  looper = () => {
    this.appendRows(this.nextRow(Date.now()));
    if (!this.subject.isStopped) {
      setTimeout(this.looper, this.query.speed);
    }
  };
}
