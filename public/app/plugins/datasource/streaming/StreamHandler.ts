import moment from 'moment';

import { Subject } from 'rxjs';
import _ from 'lodash';
import { SeriesData, DataQueryResponse, getFirstTimeField, TimeRange } from '@grafana/ui';
import { StreamingQuery, StreamingQueryOptions } from './datasource';

export class StreamHandler<T extends StreamingQuery> extends Subject<DataQueryResponse> {
  series: SeriesData = {
    fields: [{ name: 'Value' }, { name: 'Time' }],
    rows: [],
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

    // Hardcoded time format (millis, but should support any date value)
    let range: TimeRange;
    const timeIndex = getFirstTimeField(this.series);
    if (timeIndex >= 0) {
      const first = rows[0][timeIndex];
      const last = rows[rows.length - 1][timeIndex];
      const from = moment(new Date(Math.min(first, last)));
      const to = moment(new Date(Math.max(first, last)));

      range = {
        raw: {
          from,
          to,
        },
        from,
        to,
      };
    }

    this.next({
      data: [this.series],
      range,
    });
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
