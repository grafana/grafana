import {
  MutableDataFrame,
  DataSourceApi,
  DataSourceInstanceSettings,
  DataQueryRequest,
  DataQueryResponse,
  DataQuery,
} from '@grafana/data';
import { Observable, of } from 'rxjs';

export type ZipkinQuery = {
  query: string;
} & DataQuery;

export class ZipkinDatasource extends DataSourceApi<ZipkinQuery> {
  /** @ngInject */
  constructor(instanceSettings: DataSourceInstanceSettings) {
    super(instanceSettings);
    console.log(instanceSettings);
  }

  query(options: DataQueryRequest<ZipkinQuery>): Observable<DataQueryResponse> {
    return of({
      data: [
        new MutableDataFrame({
          fields: [
            {
              name: 'url',
              values: [],
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
