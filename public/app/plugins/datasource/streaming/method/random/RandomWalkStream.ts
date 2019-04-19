import _ from 'lodash';
import { StreamHandler } from '../../StreamHandler';
import { RandomStreamQuery } from './types';
import { DataQueryRequest, FieldType } from '@grafana/ui';
import { StreamingDatasource } from '../../datasource';
import { StreamingMethod } from '../../types';

const defaultQuery: RandomStreamQuery = {
  refId: 'XXX',
  method: StreamingMethod.random,
  throttle: 100, // Speed that the
  speed: 50,
  spread: 3.5,
};

export function getKeyForRandomWalk(query: RandomStreamQuery) {
  const q = _.defaults(query, defaultQuery);
  return StreamingMethod.random + '/' + q.speed + '/' + q.speed;
}

export class RandomWalkStream extends StreamHandler<RandomStreamQuery> {
  value: number;

  constructor(query: RandomStreamQuery, options: DataQueryRequest<any>, datasource: StreamingDatasource) {
    super(_.defaults(query, defaultQuery), options, datasource);

    this.looper();
  }

  initBuffer(query: RandomStreamQuery, options: DataQueryRequest<any>) {
    console.log('QUERY', options);
    const { range, intervalMs } = options;
    const { maxRowCount, series } = this;

    (series.fields = [{ name: 'Value', type: FieldType.number }, { name: 'Time', type: FieldType.time }]),
      (series.rows = []);

    this.value = Math.random();

    let time = range.from.valueOf();
    const stop = range.to.valueOf();

    const rows: any[][] = [];

    let count = 0;
    while (count++ < maxRowCount && time < stop) {
      this.value += (Math.random() - 0.5) * 0.2;
      rows.push([this.value, time]);
      time += intervalMs;
    }
    //return rows;
  }

  looper = () => {
    const { speed, spread } = this.query;
    this.value += (Math.random() - 0.5) * spread;
    this.addRows([[this.value, Date.now()]]);
    if (!this.isStopped) {
      setTimeout(this.looper, speed);
    }
  };
}
