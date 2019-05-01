import cloneDeep from 'lodash/cloneDeep';
import groupBy from 'lodash/groupBy';
import map from 'lodash/map';
import flatten from 'lodash/flatten';

import {
  DataSourceApi,
  DataQuery,
  DataQueryRequest,
  DataQueryResponse,
  LoadingState,
  DataStreamState,
  DataStreamObserver,
} from '@grafana/ui';
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';
import { getProcessedSeriesData } from 'app/features/dashboard/state/PanelQueryState';
import { toDataQueryError } from 'app/features/dashboard/state/PanelQueryState';
import { getBackendSrv } from 'app/core/services/backend_srv';

export const MIXED_DATASOURCE_NAME = '-- Mixed --';

export class MixedDatasource implements DataSourceApi<DataQuery> {
  query(request: DataQueryRequest<DataQuery>, observer: DataStreamObserver): Promise<DataQueryResponse> {
    // Remove any hidden or invalid queries
    const queries = request.targets.filter(t => {
      return !t.hide || t.datasource === MIXED_DATASOURCE_NAME;
    });

    if (!queries.length) {
      return Promise.resolve({ data: [] }); // nothing
    }

    // When more than one source, query them all together
    const sets = groupBy(queries, 'datasource');
    const names = Object.keys(sets);
    if (names.length > 1) {
      const promises = map(sets, (targets: DataQuery[]) => {
        const dsName = targets[0].datasource;
        return getDatasourceSrv()
          .get(dsName)
          .then(ds => {
            const opt = cloneDeep(request);
            opt.targets = targets;
            return ds.query(opt);
          });
      });

      return Promise.all(promises).then(results => {
        return { data: flatten(map(results, 'data')) };
      });
    }

    // Otherwise stream results as we get them
    request.subRequests = [];
    for (const query of queries) {
      const sub = cloneDeep(request);
      sub.requestId = request.requestId + '_' + request.subRequests.length;
      sub.targets = [query];
      sub.startTime = Date.now();
      request.subRequests.push(sub);
      this.startStreamingQuery(
        query.datasource,
        query.refId, // Replace existing data by refId
        sub, // the request
        observer
      );
    }
    return Promise.resolve({ data: [] }); // maybe wait for first result?
  }

  startStreamingQuery(
    datasource: string,
    key: string,
    request: DataQueryRequest<DataQuery>,
    observer: DataStreamObserver
  ) {
    const event: DataStreamState = {
      key,
      state: LoadingState.Loading,
      request,
      unsubscribe: () => {
        console.log('Cancel async query', request);
        getBackendSrv().resolveCancelerIfExists(request.requestId);
      },
    };
    observer(event); // Is this necessary?

    // Starts background process
    getDatasourceSrv()
      .get(datasource)
      .then(ds => {
        ds.query(request, observer)
          .then(res => {
            request.endTime = Date.now();
            event.state = LoadingState.Done;
            event.series = getProcessedSeriesData(res.data);
            observer(event);
          })
          .catch(err => {
            request.endTime = Date.now();
            event.state = LoadingState.Error;
            event.error = toDataQueryError(err);
            observer(event);
          });
      });
  }

  testDatasource() {
    return Promise.resolve({});
  }
}
