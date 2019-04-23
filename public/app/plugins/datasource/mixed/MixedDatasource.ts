import cloneDeep from 'lodash/cloneDeep';

import {
  DataSourceApi,
  DataQuery,
  DataQueryRequest,
  DataQueryResponse,
  LoadingState,
  DataStreamEvent,
  DataStreamObserver,
} from '@grafana/ui';
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';
import { getProcessedSeriesData } from 'app/features/dashboard/state/PanelQueryRunner';
import { toDataQueryError } from 'app/features/dashboard/state/PanelQueryState';

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
    const streams: DataStreamEvent[] = [];
    for (const query of queries) {
      const sub = cloneDeep(request);
      sub.requestId = request.requestId + '_' + request.subRequests.length;
      sub.targets = [query];
      sub.startTime = Date.now();
      request.subRequests.push(sub);
      streams.push(this.startStreamingQuery(query.datasource, query.refId, sub, observer));
    }
    return Promise.resolve({ data: [], streams });
  }

  startStreamingQuery(
    datasource: string,
    key: string,
    request: DataQueryRequest<DataQuery>,
    observer: DataStreamObserver
  ) {
    const event: DataStreamEvent = {
      key,
      state: LoadingState.Loading,
      request,
      series: [],
      shutdown: () => {
        console.log('SHUTDOWN');
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
