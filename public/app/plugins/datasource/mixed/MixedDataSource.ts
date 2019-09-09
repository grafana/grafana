import cloneDeep from 'lodash/cloneDeep';
import groupBy from 'lodash/groupBy';
import map from 'lodash/map';
import flatten from 'lodash/flatten';
import filter from 'lodash/filter';

import {
  DataSourceApi,
  DataQuery,
  DataQueryRequest,
  DataQueryResponse,
  DataStreamObserver,
  DataSourceInstanceSettings,
} from '@grafana/ui';

import { getDataSourceSrv } from '@grafana/runtime';

export const MIXED_DATASOURCE_NAME = '-- Mixed --';

export class MixedDatasource extends DataSourceApi<DataQuery> {
  constructor(instanceSettings: DataSourceInstanceSettings) {
    super(instanceSettings);
  }

  async query(request: DataQueryRequest<DataQuery>, observer: DataStreamObserver): Promise<DataQueryResponse> {
    // Remove any invalid queries
    const queries = request.targets.filter(t => {
      return t.datasource !== MIXED_DATASOURCE_NAME;
    });

    if (!queries.length) {
      return Promise.resolve({ data: [] }); // nothing
    }

    const sets = groupBy(queries, 'datasource');

    const promises = map(sets, (targets: DataQuery[]) => {
      const dsName = targets[0].datasource;
      return getDataSourceSrv()
        .get(dsName)
        .then((ds: DataSourceApi) => {
          const opt = cloneDeep(request);

          // Remove any unused hidden queries
          if (!ds.meta.hiddenQueries) {
            targets = filter(targets, (t: DataQuery) => {
              return !t.hide;
            });
            if (targets.length === 0) {
              return { data: [] };
            }
          }

          opt.targets = targets;
          return ds.query(opt);
        });
    });

    return Promise.all(promises).then(results => {
      return { data: flatten(map(results, 'data')) };
    });
  }

  testDatasource() {
    return Promise.resolve({});
  }
}
