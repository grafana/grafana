import _ from 'lodash';

import { DataSourceApi, DataQuery, DataQueryRequest } from '@grafana/ui';
import DatasourceSrv from 'app/features/plugins/datasource_srv';

class MixedDatasource implements DataSourceApi<DataQuery> {
  /** @ngInject */
  constructor(private datasourceSrv: DatasourceSrv) {}

  query(options: DataQueryRequest<DataQuery>) {
    const sets = _.groupBy(options.targets, 'datasource');
    const promises: any = _.map(sets, (targets: DataQuery[]) => {
      const dsName = targets[0].datasource;
      if (dsName === '-- Mixed --') {
        return Promise.resolve([]);
      }

      const filtered = _.filter(targets, (t: DataQuery) => {
        return !t.hide;
      });

      if (filtered.length === 0) {
        return { data: [] };
      }

      return this.datasourceSrv.get(dsName).then(ds => {
        const opt = _.cloneDeep(options);
        opt.targets = filtered;
        return ds.query(opt);
      });
    });

    return Promise.all(promises).then(results => {
      return { data: _.flatten(_.map(results, 'data')) };
    });
  }

  testDatasource() {
    return Promise.resolve({});
  }
}

export { MixedDatasource, MixedDatasource as Datasource };
