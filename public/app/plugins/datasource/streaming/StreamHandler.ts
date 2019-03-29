import { Subject } from 'rxjs';
import _ from 'lodash';
import { SeriesData } from '@grafana/ui';
import { StreamingQuery } from './types';
import { DataQueryOptions } from '@grafana/ui/src/types';
import { StreamingDatasource } from './datasource';

export class StreamHandler<T extends StreamingQuery> extends Subject<SeriesData> {
  series: SeriesData = {
    fields: [{ name: 'Value' }, { name: 'Time' }],
    rows: [],
    stream: this,
  };

  query: T;
  maxRowCount: number;

  openTime: number;
  lastTime: number;
  totalRows: number;

  constructor(query: T, options: DataQueryOptions<any>, datasource: StreamingDatasource) {
    super();

    this.query = { ...query }; // copy of the query
    this.maxRowCount = options.maxDataPoints;

    this.openTime = Date.now();
    this.lastTime = this.openTime;
    this.totalRows = 0;

    this.series.refId = query.refId;
    this.initBuffer(query, options);
  }

  initBuffer(query: T, options: DataQueryOptions<any>) {
    // Can fill this up
  }

  getSubscriberCount(): number {
    return this.observers.length;
  }

  addRows(add: any[][]) {
    let rows = this.series.rows;

    this.lastTime = Date.now();
    if (this.observers.length < 1) {
      const elapsed = this.lastTime - this.openTime;
      if (elapsed > 500) {
        this.complete();
        console.log('Got rows, but nothign is listening... stopping stream', this);
        return;
      }
    }

    // Add each row
    for (const row of add) {
      rows.push(row);
      this.totalRows++;
    }

    // Trim the maximum row count
    const extra = this.maxRowCount - rows.length;
    if (extra < 0) {
      rows = rows.slice(extra * -1);
      this.series.rows = rows;
    }

    // update the series
    this.next(this.series);
  }

  error(err: any): void {
    super.error(err);
    console.log('GOT AN ERROR!', err, this);
  }
}
