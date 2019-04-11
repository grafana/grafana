import _ from 'lodash';
import { StreamHandler } from '../../StreamHandler';
import { SeriesData, CSVReader } from '@grafana/ui';
import { StreamingDatasource } from '../../datasource';
import { FetchQuery } from './types';

import { DataQueryOptions } from '@grafana/ui';

// polyfil for TextEncoder/TextDecoder (node & IE)
import 'fast-text-encoding'; //'text-encoding';  // 'fast-text-encoding';
import { StreamingMethod } from '../../types';

const defaultQuery: FetchQuery = {
  refId: 'XXX',
  method: StreamingMethod.fetch,
  throttle: 100, // Speed that the
  speed: 50,
  spread: 3.5,
  url: 'http://localhost:7777/',
};

export function getKeyForFetch(query: FetchQuery) {
  const q = _.defaults(query, defaultQuery);
  let url = q.url;
  if (url.includes('?')) {
    url += '&speed=' + q.speed;
  } else {
    url += '?speed=' + q.speed;
  }
  for (const field of q.fields || []) {
    url += '&field=' + field;
  }
  url += '&spread=' + q.spread;
  return url;
}

export class FetchStream extends StreamHandler<FetchQuery> {
  csv: CSVReader;
  reader: ReadableStreamReader<Uint8Array>;

  constructor(query: FetchQuery, options: DataQueryOptions<any>, datasource: StreamingDatasource) {
    super(_.defaults(query, defaultQuery), options, datasource);

    this.csv = new CSVReader({ callback: this });

    const url = getKeyForFetch(this.query);

    // TODO! fetch via the datasource config with credentials etc
    // Support errors and reconnects!
    fetch(new Request(url)).then(response => {
      console.log('RESPONSE', response.body);
      this.reader = response.body.getReader();
      this.reader.read().then(this.processChunk);
    });
  }

  processChunk = (value: ReadableStreamReadResult<Uint8Array>): any => {
    if (this.isStopped) {
      this.complete();
      return; // Nothing more to do
    }

    if (value.value) {
      const text = new TextDecoder().decode(value.value);
      this.csv.readCSV(text);
    }

    if (value.done) {
      console.log('Finished stream');
      this.complete();
      return;
    }

    return this.reader.read().then(this.processChunk);
  };

  onHeader = (series: SeriesData) => {
    series.refId = this.series.refId;
    series.stream = this.series.stream;
    this.series = series;
  };

  onRow = (row: any[]) => {
    // TODO?? this will send an event for each row, even if the chunk passed a bunch of them
    this.addRows([row]);
  };
}
