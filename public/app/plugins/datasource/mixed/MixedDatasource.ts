import _ from 'lodash';

import { DataSourceApi, DataQuery, DataQueryRequest, DataQueryResponse } from '@grafana/ui';
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';

export class MixedDatasource implements DataSourceApi<DataQuery> {
  query(request: DataQueryRequest<DataQuery>): Promise<DataQueryResponse> {
    const datasourceSrv = getDatasourceSrv();
    const queries = request.targets.filter(t => !!t.hide);
    const sets = _.groupBy(queries, 'datasource');
    console.log('SETS', sets, datasourceSrv);

    return Promise.resolve({ data: [] });

    // const promises: any = _.map(sets, (targets: DataQuery[]) => {
    //   const dsName = targets[0].datasource;
    //   if (dsName === '-- Mixed --') {
    //     return Promise.resolve([]);
    //   }

    //   const filtered = _.filter(targets, (t: DataQuery) => {
    //     return !t.hide;
    //   });

    //   if (filtered.length === 0) {
    //     return { data: [] };
    //   }

    //   return this.datasourceSrv.get(dsName).then(ds => {
    //     const opt = _.cloneDeep(options);
    //     opt.targets = filtered;
    //     return ds.query(opt);
    //   });
    // });

    // return Promise.all(promises).then(results => {
    //   return { data: _.flatten(_.map(results, 'data')) };
    // });
  }

  testDatasource() {
    return Promise.resolve({});
  }
}
