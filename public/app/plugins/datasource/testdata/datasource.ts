import { from, merge, Observable, of } from 'rxjs';
import { delay, map, mergeMap } from 'rxjs/operators';
import set from 'lodash/set';
import { v4 as uuidv4 } from 'uuid';
import {
  AnnotationEvent,
  ArrayDataFrame,
  arrowTableToDataFrame,
  base64StringToArrowTable,
  CoreApp,
  DataFrame,
  DataQueryError,
  DataQueryRequest,
  DataQueryResponse,
  DataSourceApi,
  DataSourceInstanceSettings,
  DataTopic,
  DefaultTimeRange,
  LoadingState,
  MetricFindValue,
  TableData,
  TimeRange,
  TimeSeries,
  toDataFrame,
} from '@grafana/data';
import { getBackendSrv, getTemplateSrv, TemplateSrv, toDataQueryError } from '@grafana/runtime';

import { Scenario, TestDataQuery } from './types';
import { queryMetricTree } from './metricTree';
import { runStream } from './runStreams';
import { getSearchFilterScopedVar } from 'app/features/variables/utils';

type TestData = TimeSeries | TableData;

export class TestDataDataSource extends DataSourceApi<TestDataQuery> {
  constructor(
    instanceSettings: DataSourceInstanceSettings,
    private readonly templateSrv: TemplateSrv = getTemplateSrv()
  ) {
    super(instanceSettings);

    this.variables = {
      toMetricFindValues: () => dataStream =>
        dataStream.pipe(
          mergeMap(data => {
            if (!data || data.length === 0) {
              return of([]);
            }

            const frame = data[0];
            const values: MetricFindValue[] = [];
            for (let index = 0; index < frame.length; index++) {
              const text = frame.fields[0].values.get(index);
              const value = frame.fields[1].values.get(index);
              values.push({ text, value });
            }

            return of(values);
          })
        ),
      toDataQueryRequest: (query, scopedVars) => {
        const targets: TestDataQuery[] = [
          {
            datasource: instanceSettings.name,
            refId: `variable-query-${instanceSettings.name}`,
            scenarioId: 'metric_find_query',
            stringInput: query,
          },
        ];

        const request: DataQueryRequest<TestDataQuery> = {
          targets,
          app: CoreApp.Dashboard,
          range: DefaultTimeRange,
          scopedVars,
          requestId: uuidv4(),
          intervalMs: 0,
          timezone: 'utc',
          interval: '',
          startTime: Date.now(),
        };

        return request;
      },
    };
  }

  query(options: DataQueryRequest<TestDataQuery>): Observable<DataQueryResponse> {
    const queries: any[] = [];
    const streams: Array<Observable<DataQueryResponse>> = [];

    // Start streams and prepare queries
    for (const target of options.targets) {
      if (target.hide) {
        continue;
      }

      switch (target.scenarioId) {
        case 'streaming_client':
          streams.push(runStream(target, options));
          break;
        case 'grafana_api':
          streams.push(runGrafanaAPI(target, options));
          break;
        case 'arrow':
          streams.push(runArrowFile(target, options));
          break;
        case 'annotations':
          streams.push(this.annotationDataTopicTest(target, options));
          break;
        case 'metric_find_query':
          streams.push(this.handleVariablesQuery(options));
          break;
        default:
          queries.push({
            ...target,
            intervalMs: options.intervalMs,
            maxDataPoints: options.maxDataPoints,
            datasourceId: this.id,
            alias: this.templateSrv.replace(target.alias || '', options.scopedVars),
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

  annotationDataTopicTest(target: TestDataQuery, req: DataQueryRequest<TestDataQuery>): Observable<DataQueryResponse> {
    return new Observable<DataQueryResponse>(observer => {
      const events = this.buildFakeAnnotationEvents(req.range, 10);
      const dataFrame = new ArrayDataFrame(events);
      dataFrame.meta = { dataTopic: DataTopic.Annotations };

      observer.next({ key: target.refId, data: [dataFrame] });
    });
  }

  buildFakeAnnotationEvents(range: TimeRange, count: number): AnnotationEvent[] {
    let timeWalker = range.from.valueOf();
    const to = range.to.valueOf();
    const events = [];
    const step = (to - timeWalker) / count;

    for (let i = 0; i < count; i++) {
      events.push({
        time: timeWalker,
        text: 'This is the text, <a href="https://grafana.com">Grafana.com</a>',
        tags: ['text', 'server'],
      });
      timeWalker += step;
    }

    return events;
  }

  annotationQuery(options: any) {
    return Promise.resolve(this.buildFakeAnnotationEvents(options.range, 10));
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

  private handleVariablesQuery(options: DataQueryRequest<TestDataQuery>): Observable<DataQueryResponse> {
    if (options.targets.length === 0) {
      return of({ state: LoadingState.Done, data: [] });
    }

    const { stringInput } = options.targets[0];
    const interpolatedQuery = this.templateSrv.replace(
      stringInput,
      getSearchFilterScopedVar({ query: stringInput, wildcardChar: '*', options: options.scopedVars })
    );
    const children = queryMetricTree(interpolatedQuery);
    const items = children.map(item => ({ value: item.name, text: item.name }));

    return of({ state: LoadingState.Done, data: [toDataFrame(items)] }).pipe(delay(100));
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
