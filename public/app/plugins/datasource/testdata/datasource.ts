import set from 'lodash/set';

import {
  ArrayDataFrame,
  arrowTableToDataFrame,
  base64StringToArrowTable,
  DataFrame,
  DataQueryError,
  DataQueryRequest,
  DataQueryResponse,
  DataSourceApi,
  DataSourceInstanceSettings,
  LoadingState,
  MetricFindValue,
  TableData,
  TimeSeries,
} from '@grafana/data';
import { Scenario, TestDataQuery } from './types';
import { getBackendSrv, toDataQueryError } from '@grafana/runtime';
import { queryMetricTree } from './metricTree';
import { from, merge, Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { runStream } from './runStreams';
import templateSrv from 'app/features/templating/template_srv';
import { getSearchFilterScopedVar } from 'app/features/variables/utils';

type TestData = TimeSeries | TableData;

export class TestDataDataSource extends DataSourceApi<TestDataQuery> {
  constructor(instanceSettings: DataSourceInstanceSettings) {
    super(instanceSettings);
  }

  query(options: DataQueryRequest<TestDataQuery>): Observable<DataQueryResponse> {
    const queries: any[] = [];
    const streams: Array<Observable<DataQueryResponse>> = [];

    // Start streams and prepare queries
    for (const target of options.targets) {
      if (target.hide) {
        continue;
      }
      if (target.scenarioId === 'streaming_client') {
        streams.push(runStream(target, options));
      } else if (target.scenarioId === 'grafana_api') {
        streams.push(runGrafanaAPI(target, options));
      } else if (target.scenarioId === 'arrow') {
        streams.push(runArrowFile(target, options));
      } else {
        queries.push({
          ...target,
          intervalMs: options.intervalMs,
          maxDataPoints: options.maxDataPoints,
          datasourceId: this.id,
          alias: templateSrv.replace(target.alias || '', options.scopedVars),
        });
      }
    }

    if (queries.length) {
      const stream = getBackendSrv()
        .fetch({
          method: 'POST',
          url: '/api/tsdb/query',
          data: {
            from: options.range.from.valueOf().toString(),
            to: options.range.to.valueOf().toString(),
            queries: queries,
          },
        })
        .pipe(map(res => this.processQueryResult(queries, res)));

      streams.push(stream);
    }

    return merge(...streams);
  }

  processQueryResult(queries: any, res: any): DataQueryResponse {
    const data: TestData[] = [];
    let error: DataQueryError | undefined = undefined;

    for (const query of queries) {
      const results = res.data.results[query.refId];

      for (const t of results.tables || []) {
        const table = t as TableData;
        table.refId = query.refId;
        table.name = query.alias;

        if (query.scenarioId === 'logs') {
          set(table, 'meta.preferredVisualisationType', 'logs');
        }

        data.push(table);
      }

      for (const series of results.series || []) {
        data.push({ target: series.name, datapoints: series.points, refId: query.refId, tags: series.tags });
      }

      if (results.error) {
        error = {
          message: results.error,
        };
      }
    }

    return { data, error };
  }

  annotationQuery(options: any) {
    let timeWalker = options.range.from.valueOf();
    const to = options.range.to.valueOf();
    const events = [];
    const eventCount = 10;
    const step = (to - timeWalker) / eventCount;

    for (let i = 0; i < eventCount; i++) {
      events.push({
        annotation: options.annotation,
        time: timeWalker,
        text: 'This is the text, <a href="https://grafana.com">Grafana.com</a>',
        tags: ['text', 'server'],
      });
      timeWalker += step;
    }
    return Promise.resolve(events);
  }

  getQueryDisplayText(query: TestDataQuery) {
    if (query.alias) {
      return query.scenarioId + ' as ' + query.alias;
    }
    return query.scenarioId;
  }

  testDatasource() {
    return Promise.resolve({
      status: 'success',
      message: 'Data source is working',
    });
  }

  getScenarios(): Promise<Scenario[]> {
    return getBackendSrv().get('/api/tsdb/testdata/scenarios');
  }

  metricFindQuery(query: string, options: any) {
    return new Promise<MetricFindValue[]>((resolve, reject) => {
      setTimeout(() => {
        const interpolatedQuery = templateSrv.replace(
          query,
          getSearchFilterScopedVar({ query, wildcardChar: '*', options })
        );
        const children = queryMetricTree(interpolatedQuery);
        const items = children.map(item => ({ value: item.name, text: item.name }));
        resolve(items);
      }, 100);
    });
  }
}

function runArrowFile(target: TestDataQuery, req: DataQueryRequest<TestDataQuery>): Observable<DataQueryResponse> {
  let data: DataFrame[] = [];
  if (target.stringInput && target.stringInput.length > 10) {
    try {
      const table = base64StringToArrowTable(target.stringInput);
      data = [arrowTableToDataFrame(table)];
    } catch (e) {
      console.warn('Error reading saved arrow', e);
      const error = toDataQueryError(e);
      error.refId = target.refId;
      return of({ state: LoadingState.Error, error, data });
    }
  }
  return of({ state: LoadingState.Done, data });
}

function runGrafanaAPI(target: TestDataQuery, req: DataQueryRequest<TestDataQuery>): Observable<DataQueryResponse> {
  const url = `/api/${target.stringInput}`;
  return from(
    getBackendSrv()
      .get(url)
      .then(res => {
        const frame = new ArrayDataFrame(res);
        return {
          state: LoadingState.Done,
          data: [frame],
        };
      })
  );
}
