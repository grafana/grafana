import { from, Observable, of } from 'rxjs';

import {
  AnnotationQuery,
  DataQuery,
  DataQueryRequest,
  DataQueryResponse,
  TestDataSourceResponse,
  DataSourceApi,
  DataSourceJsonData,
  DataSourcePluginMeta,
  toDataFrame,
} from '@grafana/data';
import { config, getBackendSrv } from '@grafana/runtime';
import { GRAFANA_DATASOURCE_NAME } from 'app/features/alerting/unified/utils/datasource';

import { GrafanaQueryType } from '../../../../plugins/datasource/grafana/types';

export const PUBLIC_DATASOURCE = '-- Public --';

export class PublicAnnotationsDataSource extends DataSourceApi<DataQuery, DataSourceJsonData, {}> {
  constructor() {
    let meta = {} as DataSourcePluginMeta;

    super({
      name: 'public-ds',
      id: 0,
      type: 'public-ds',
      meta,
      uid: PUBLIC_DATASOURCE,
      jsonData: {},
      access: 'proxy',
      readOnly: true,
    });

    this.annotations = {
      prepareQuery(anno: AnnotationQuery): DataQuery | undefined {
        return { ...anno, queryType: GrafanaQueryType.Annotations, refId: 'anno' };
      },
    };
  }

  /**
   * Ideally final -- any other implementation may not work as expected
   */
  query(request: DataQueryRequest<DataQuery>): Observable<DataQueryResponse> {
    // Return early if no queries exist
    if (!request.targets.length) {
      return of({ data: [] });
    }

    // Currently, annotations requests come in one at a time, so there will only be one target
    const target = request.targets[0];

    if (target?.datasource?.uid === GRAFANA_DATASOURCE_NAME) {
      return from(this.getAnnotations(request));
    }
    return of({ data: [] });
  }

  async getAnnotations(request: DataQueryRequest<DataQuery>): Promise<DataQueryResponse> {
    const {
      range: { to, from },
    } = request;

    const params = {
      from: from.valueOf(),
      to: to.valueOf(),
    };

    const annotations = await getBackendSrv().get(
      `/api/public/dashboards/${config.publicDashboardAccessToken}/annotations`,
      params
    );

    return { data: [toDataFrame(annotations)] };
  }

  testDatasource(): Promise<TestDataSourceResponse> {
    return Promise.resolve({ message: '', status: '' });
  }
}
