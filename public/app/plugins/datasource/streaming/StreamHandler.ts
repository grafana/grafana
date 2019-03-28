import { Subject } from 'rxjs';
import _ from 'lodash';
import { SeriesData } from '@grafana/ui';
import { StreamingQuery, StreamingQueryOptions } from './datasource';

export class StreamHandler<T extends StreamingQuery> extends Subject<SeriesData> {
  series: SeriesData = {
    fields: [{ name: 'Value' }, { name: 'Time' }],
    rows: [],
    stream: this,
  };

  options: StreamingQueryOptions<T>;

  constructor(options: StreamingQueryOptions<T>, datasource: any) {
    super();

    this.options = options; // _.defaults(options, defaultOptions);
    this.initBuffer(this.options);
  }

  initBuffer(options: StreamingQueryOptions<T>) {
    // TOTO
  }

  addRows(add: any[][]) {
    let rows = this.series.rows;

    // Add each row
    add.forEach(row => {
      rows.push(row);
    });

    const extra = this.options.maxDataPoints - rows.length;
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
