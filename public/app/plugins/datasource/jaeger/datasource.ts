import {
  MutableDataFrame,
  DataSourceApi,
  DataSourceInstanceSettings,
  DataQueryRequest,
  DataQueryResponse,
  DataQuery,
} from '@grafana/data';
import { Observable, of } from 'rxjs';

export type JaegerQuery = {
  query: string;
} & DataQuery;

export class JaegerDatasource extends DataSourceApi<JaegerQuery> {
  /** @ngInject */
  constructor(private instanceSettings: DataSourceInstanceSettings) {
    super(instanceSettings);
  }

  query(options: DataQueryRequest<JaegerQuery>): Observable<DataQueryResponse> {
    //http://localhost:16686/search?end=1573338717880000&limit=20&lookback=6h&maxDuration&minDuration&service=app&start=1573317117880000
    const url =
      options.targets.length && options.targets[0].query
        ? `${this.instanceSettings.url}/trace/${options.targets[0].query}?uiEmbed=v0`
        : '';

    return of({
      data: [
        new MutableDataFrame({
          fields: [
            {
              name: 'url',
              values: [url],
            },
          ],
        }),
      ],
    });
  }

  async testDatasource(): Promise<any> {
    return true;
  }
}
