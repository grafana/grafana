import _ from 'lodash';
import { StreamHandler } from './StreamHandler';
import { StreamingQuery, StreamingQueryOptions } from './datasource';

export class RandomWalkStream extends StreamHandler<StreamingQuery> {
  value: number;

  constructor(options: StreamingQueryOptions<StreamingQuery>, datasource: any) {
    super(options, datasource);

    this.value = Math.random();
    this.series.rows = this.fillBuffer(options);
    this.looper();
  }

  initBuffer(options: StreamingQueryOptions<StreamingQuery>) {
    // TOTO
    console.log('FILL Buffer: ' + options);
  }

  fillBuffer(options): any[][] {
    console.log('QUERY', options);
    const { range, intervalMs, maxDataPoints } = options;

    let time = range.from.valueOf();
    const stop = range.to.valueOf();

    const rows: any[][] = [];

    let count = 0;
    while (count++ < maxDataPoints * 2 && time < stop) {
      this.value += (Math.random() - 0.5) * 0.2;
      rows.push([this.value, time]);
      time += intervalMs;
    }
    return rows;
  }

  looper = () => {
    this.value += (Math.random() - 0.5) * 0.2;
    this.addRows([[this.value, Date.now()]]);
    setTimeout(this.looper, 10); //this.options.delay);
  };
}
