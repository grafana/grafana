import _ from 'lodash';
import { StreamHandler } from './StreamHandler';
import { StreamingQuery, StreamingQueryOptions } from './datasource';
import { SeriesData, readCSVFromStream } from '@grafana/ui';

export class RequestStream extends StreamHandler<StreamingQuery> {
  constructor(options: StreamingQueryOptions<StreamingQuery>, datasource: any) {
    super(options, datasource);

    const request = new Request(`http://localhost:7777/`);
    fetch(request).then(response => {
      console.log('RESPONSE', response.body);
      readCSVFromStream(response.body.getReader(), {
        callback: this,
      }).then(() => {
        console.log('DONE!');
      });
    });
  }

  /**
   * Get a callback before any rows are processed
   * This can return a modified table to force any
   * Column configurations
   */
  onHeader = (series: SeriesData) => {
    this.series = series; // resets the buffer size
    console.log('SERIES', this.series);
  };

  onRow = (row: any[]) => {
    this.addRows([row]);
  };
}
