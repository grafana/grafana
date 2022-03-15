//@ts-nocheck
import {
  DataQueryRequest,
  DataQueryResponse,
  DataSourceApi,
  DataSourceInstanceSettings,
  MutableDataFrame,
  FieldType,
} from '@grafana/data';
import { getBackendSrv, BackendSrv, getTemplateSrv } from '@grafana/runtime';

import { defaultQuery, FlamegraphQuery, MyDataSourceOptions } from './types';
import { deltaDiff } from './flamebearer';

export class DataSource extends DataSourceApi<FlamegraphQuery, MyDataSourceOptions> {
  constructor(instanceSettings: DataSourceInstanceSettings<MyDataSourceOptions>) {
    super(instanceSettings);
    this.instanceSettings = instanceSettings;
    this.backendSrv = getBackendSrv();
    this.url = instanceSettings.url || '';
  }

  instanceSettings: DataSourceInstanceSettings<MyDataSourceOptions>;

  backendSrv: BackendSrv;

  url: string;

  async getFlamegraph(query: FlamegraphQuery) {
    // transform 'name' -> 'query'
    // and also get rid of 'name', since it would affect the results
    const { name, ...newQuery } = { ...query, query: query.name };

    const result = await this.backendSrv
      .fetch({
        method: 'GET',
        url: `${this.url}/render/render`,
        params: newQuery,
      })
      .toPromise();

    return result;
  }

  async getNames() {
    const result = await this.backendSrv
      .fetch<string[]>({
        method: 'GET',
        url: `${this.url}/render/label-values?label=__name__`,
      })
      .toPromise();

    return result;
  }

  async query(options: DataQueryRequest<FlamegraphQuery>): Promise<DataQueryResponse> {
    const { range } = options;
    const from = range.raw.from.valueOf();
    const until = range.raw.to.valueOf();

    const promises = options.targets.map((query) => {
      const nameFromVar = getTemplateSrv().replace(query.name);

      return this.getFlamegraph({
        ...defaultQuery,
        ...query,
        name: nameFromVar,
        from,
        until,
      }).then((response: any) => {
        const frame = new MutableDataFrame({
          refId: query.refId,
          name: nameFromVar,
          fields: [{ name: 'flamebearer', type: FieldType.other }],
          meta: {
            preferredVisualisationType: 'profile',
          },
        });

        frame.appendRow([
          {
            ...response.data.flamebearer,
            ...response.data.metadata,
            levels: deltaDiff(response.data.flamebearer.levels),
          },
        ]);

        return frame;
      });
    });
    return Promise.all(promises).then((data) => ({ data }));
  }

  loadAppNames(): Promise<any> {
    return this.getNames();
  }

  async testDatasource() {
    const names = await this.getNames();
    if (names?.status === 200) {
      return {
        status: 'success',
        message: 'Success',
      };
    }
    return {
      status: 'error',
      message: 'Server is not reachable',
    };
  }
}
