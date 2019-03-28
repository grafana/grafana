import _ from 'lodash';
import { StreamHandler } from './StreamHandler';
import { StreamingQuery, StreamingQueryOptions } from './datasource';
import { SeriesData, CSVReader } from '@grafana/ui';

// polyfil for TextEncoder/TextDecoder (node & IE)
import 'fast-text-encoding'; //'text-encoding';  // 'fast-text-encoding';

export class RequestStream extends StreamHandler<StreamingQuery> {
  csv: CSVReader;
  reader: ReadableStreamReader<Uint8Array>;

  constructor(query: StreamingQuery, options: StreamingQueryOptions<StreamingQuery>, datasource: any) {
    super(query, options, datasource);

    this.csv = new CSVReader({ callback: this });

    let url = query.url;
    if (!url.includes('?')) {
      url += '?x';
    }

    // TODO! fetch via the datasource config with credentials etc
    const request = new Request(`${url}&speed=${query.speed}&spread=${query.spread}`);
    fetch(request).then(response => {
      console.log('RESPONSE', response.body);

      this.reader = response.body.getReader();
      this.reader.read().then(this.processChunk);
    });
  }

  processChunk = (value: ReadableStreamReadResult<Uint8Array>): any => {
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
    this.addRows([row]);
  };
}
