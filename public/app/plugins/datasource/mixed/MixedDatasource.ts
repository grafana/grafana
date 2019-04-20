import cloneDeep from 'lodash/cloneDeep';

import {
  DataSourceApi,
  DataQuery,
  DataQueryRequest,
  DataQueryResponse,
  LoadingState,
  DataStreamEvent,
  DataStreamEventObserver,
} from '@grafana/ui';
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';
import { getProcessedSeriesData } from 'app/features/dashboard/state/PanelQueryRunner';
import { toDataQueryError } from 'app/features/dashboard/state/PanelQueryState';

export const MIXED_DATASOURCE_NAME = '-- Mixed --';

export class MixedDatasource implements DataSourceApi<DataQuery> {
  async query(request: DataQueryRequest<DataQuery>, stream?: DataStreamEventObserver): Promise<DataQueryResponse> {
    const datasourceSrv = getDatasourceSrv();

    // Remove any hidden or invalid queries
    const queries = request.targets.filter(t => {
      return !t.hide || t.datasource === MIXED_DATASOURCE_NAME;
    });

    if (!queries.length) {
      return Promise.resolve({ data: [] }); // nothing
    }

    if (!stream) {
      throw new Error('Mixed Query requires streaming callback');
    }

    // Update the sub request list
    request.subRequests = [];
    for (const query of queries) {
      const sub = cloneDeep(request);
      sub.requestId = request.requestId + '_' + request.subRequests.length;
      sub.targets = [query];
      sub.startTime = Date.now();
      request.subRequests.push(sub);
      const data: DataStreamEvent = {
        state: LoadingState.Loading,
        request: sub,
        series: [],
      };
      stream.next(data);

      // Starts the request async
      datasourceSrv.get(query.datasource).then(ds => {
        return ds
          .query(sub, stream)
          .then(res => {
            sub.endTime = Date.now();
            data.state = LoadingState.Done;
            data.series = getProcessedSeriesData(res.data);
            stream.next(data);
          })
          .catch(err => {
            sub.endTime = Date.now();
            data.state = LoadingState.Error;
            data.error = toDataQueryError(err);
            stream.next(data);
          });
      });
    }

    // Return, but keep listening for changes
    return Promise.resolve({ data: [], streaming: true });
  }

  testDatasource() {
    return Promise.resolve({});
  }
}
