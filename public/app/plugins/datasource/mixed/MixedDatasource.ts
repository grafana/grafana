import cloneDeep from 'lodash/cloneDeep';

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

    if (!observer) {
      throw new Error('Mixed Query requires streaming callback');
    }

    // Update the sub request list
    request.subRequests = [];
    const streams: DataStreamState[] = [];
    for (const query of queries) {
      const sub = cloneDeep(request);
      sub.requestId = request.requestId + '_' + request.subRequests.length;
      sub.targets = [query];
      sub.startTime = Date.now();
      request.subRequests.push(sub);
      streams.push(this.startStreamingQuery(query.datasource, query.refId, sub, observer));
    }

    return Promise.resolve({ data: [] });
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
      series: [],
      unsubscribe: () => {
        console.log('Cancel async query', request);
        getBackendSrv().resolveCancelerIfExists(request.requestId);
      },
    };

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

    return event;
  }

  testDatasource() {
    return Promise.resolve({});
  }
}
