import groupBy from 'lodash/groupBy';
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
    let needsDefatulDS = false;

    // Remove any hidden and invalid queries
    let queries = request.targets.filter(t => {
      if (!t.datasource) {
        needsDefatulDS = true;
      }
      return !t.hide || t.datasource !== MIXED_DATASOURCE_NAME;
    });

    if (needsDefatulDS) {
      const defaultDS = await datasourceSrv.get();
      queries = queries.map(q => {
        if (!q.datasource) {
          q.datasource = defaultDS.name;
        }
        return q;
      });
    }

    const sets = groupBy(queries, 'datasource');
    const sources = Object.keys(sets);
    if (!sources.length) {
      return Promise.resolve({ data: [] }); // nothing
    }

    // For a single datasource, just delegate
    if (sources.length === 1) {
      const ds = await datasourceSrv.get(sources[0]);
      return ds.query(request, stream);
    }

    // Update the sub request list
    request.subRequests = [];

    let finished = 0;
    const everything: QueryResultBase[] = [];

    const promises = sources.map((name, index) => {
      return datasourceSrv.get(name).then(ds => {
        const sub = cloneDeep(request);
        sub.requestId = request.requestId + '_' + index;
        sub.targets = sets[name];
        sub.startTime = Date.now();
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
            const results = res.data.map((r: QueryResultBase) => {
              if (!r.meta) {
                r.meta = { requestId: sub.requestId };
              } else {
                r.meta.requestId = sub.requestId;
              }
              everything.push(r);
              return;
            });

            if (stream && finished < promises.length) {
              data.series = getProcessedSeriesData(results);
              stream.onStreamProgress(data);
            }
            return { data: results };
          })
          .catch(err => {
            sub.endTime = Date.now();
            data.state = LoadingState.Error;
            data.error = toDataQueryError(err);
            finished++;
            if (stream && finished < promises.length) {
              stream.onStreamProgress(data);
            }
          });
      });
    });
    return Promise.all(promises).then(results => {
      return { data: everything };
    });
  }

  testDatasource() {
    return Promise.resolve({});
  }
}
