import {
  DataFrame,
  DataQuery,
  DataQueryRequest,
  DataQueryResponse,
  DataSourceInstanceSettings,
  FieldType,
  MutableDataFrame,
} from '@grafana/data';
import { DataSourceWithBackend } from '@grafana/runtime';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export type TempoQuery = {
  query: string;
} & DataQuery;

export class TempoDatasource extends DataSourceWithBackend<TempoQuery> {
  constructor(instanceSettings: DataSourceInstanceSettings) {
    super(instanceSettings);
  }

  query(options: DataQueryRequest<TempoQuery>): Observable<DataQueryResponse> {
    return super.query(options).pipe(
      map((response) => {
        if (response.error) {
          return response;
        }

        return {
          data: [
            new MutableDataFrame({
              fields: [
                {
                  name: 'trace',
                  type: FieldType.trace,
                  values: [JSON.parse((response.data as DataFrame[])[0].fields[0].values.get(0))],
                },
              ],
              meta: {
                preferredVisualisationType: 'trace',
              },
            }),
          ],
        };
      })
    );
  }

  async testDatasource(): Promise<any> {
    const response = await super.query({ targets: [{ query: '', refId: 'A' }] } as any).toPromise();

    if (!response.error?.message?.startsWith('failed to get trace')) {
      return { status: 'error', message: 'Data source is not working' };
    }

    return { status: 'success', message: 'Data source is working' };
  }

  getQueryDisplayText(query: TempoQuery) {
    return query.query;
  }
}
