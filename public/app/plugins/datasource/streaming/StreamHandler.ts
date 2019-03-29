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

  addRows(add: any[][]) {
    let rows = this.series.rows;

    // Add each row
    add.forEach(row => {
      rows.push(row);
    });

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

  complete(): void {
    super.complete();
    console.log('COMPLETE', this);
  }
}
