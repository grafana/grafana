import _ from 'lodash';

import { DataSourceApi, DataQuery, DataQueryRequest, DataSourceInstanceSettings } from '@grafana/ui';
import DatasourceSrv from 'app/features/plugins/datasource_srv';

class MixedDatasource extends DataSourceApi<DataQuery> {
  /** @ngInject */
  constructor(instanceSettings: DataSourceInstanceSettings, private datasourceSrv: DatasourceSrv) {
    super(instanceSettings);
  }

  query(options: DataQueryRequest<DataQuery>) {
    const sets = _.groupBy(options.targets, 'datasource');
    const promises: any = _.map(sets, (targets: DataQuery[]) => {
      const dsName = targets[0].datasource;
      if (dsName === '-- Mixed --') {
        return Promise.resolve([]);
      }

      if (targets.length === 0) {
        return { data: [] };
      }

      return this.datasourceSrv.get(dsName).then(ds => {
        // Remove any unused hidden queries
        if (!ds.meta.hiddenQueries) {
          targets = _.filter(targets, (t: DataQuery) => {
            return !t.hide;
          });
          if (targets.length === 0) {
            return { data: [] };
          }
        }

        const opt = _.cloneDeep(options);
        opt.targets = targets;
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
