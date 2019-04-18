import cloneDeep from 'lodash/cloneDeep';

import {
  DataSourceApi,
  DataQuery,
  DataQueryRequest,
  DataQueryResponse,
  DataSourceStream,
  PanelData,
  LoadingState,
  QueryResultBase,
} from '@grafana/ui';
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';
import { getProcessedSeriesData, toDataQueryError } from 'app/features/dashboard/state/PanelQueryRunner';

export const MIXED_DATASOURCE_NAME = '-- Mixed --';

export class MixedDatasource implements DataSourceApi<DataQuery> {
  async query(request: DataQueryRequest<DataQuery>, stream?: DataSourceStream): Promise<DataQueryResponse> {
    const datasourceSrv = getDatasourceSrv();

    // Remove any hidden or invalid queries
    const queries = request.targets.filter(t => {
      return !t.hide || t.datasource === MIXED_DATASOURCE_NAME;
    });

    if (!queries.length) {
      return Promise.resolve({ data: [] }); // nothing
    }

    // Update the sub request list
    request.subRequests = [];

    let finished = 0;
    const results: QueryResultBase[] = [];
    const all = queries.map((query, index) => {
      return datasourceSrv.get(query.datasource).then(ds => {
        const sub = cloneDeep(request);
        sub.requestId = request.requestId + '_' + index;
        sub.targets = [query];
        sub.startTime = Date.now();
        request.subRequests.push(sub);
        const data: PanelData = {
          state: LoadingState.Loading,
          request: sub,
          series: [],
        };
        if (stream) {
          stream.onStreamProgress(data);
        }
        return ds
          .query(sub, stream)
          .then(res => {
            sub.endTime = Date.now();
            data.state = LoadingState.Done;
            finished++;

            // Attach the requestId to the returned results
            const withMeta = res.data.map((r: QueryResultBase) => {
              if (!r.meta) {
                r.meta = { requestId: sub.requestId };
              } else {
                r.meta.requestId = sub.requestId;
              }
              results.push(r);
              return r;
            });

            if (stream && finished < all.length) {
              data.series = getProcessedSeriesData(withMeta);
              stream.onStreamProgress(data);
            }
            return { data: withMeta };
          })
          .catch(err => {
            sub.endTime = Date.now();
            data.state = LoadingState.Error;
            data.error = toDataQueryError(err);
            finished++;
            if (stream && finished < all.length) {
              stream.onStreamProgress(data);
            }
          });
      });
    });

    // Return the values we collected
    return Promise.all(all).then(() => {
      console.log('Mixed Done!');

      return { data: results };
    });
  }

  testDatasource() {
    return Promise.resolve({});
  }
}
