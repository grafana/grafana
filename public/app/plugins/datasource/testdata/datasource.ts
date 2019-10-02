import _ from 'lodash';
import {
  DataSourceApi,
  DataQueryRequest,
  DataSourceInstanceSettings,
  DataQueryResponse,
  MetricFindValue,
} from '@grafana/ui';
import { TableData, TimeSeries } from '@grafana/data';
import { TestDataQuery, Scenario } from './types';
import { getBackendSrv } from 'app/core/services/backend_srv';
import { queryMetricTree } from './metricTree';
import { Observable, from, merge } from 'rxjs';
import { runStream } from './runStreams';
import templateSrv from 'app/features/templating/template_srv';

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
      if (target.scenarioId === 'streaming_client') {
        streams.push(runStream(target, options));
      } else {
        queries.push({
          ...target,
          intervalMs: options.intervalMs,
          maxDataPoints: options.maxDataPoints,
          datasourceId: this.id,
          alias: templateSrv.replace(target.alias || ''),
        });
      }
    }

    if (queries.length) {
      const req: Promise<DataQueryResponse> = getBackendSrv()
        .datasourceRequest({
          method: 'POST',
          url: '/api/tsdb/query',
          data: {
            from: options.range.from.valueOf().toString(),
            to: options.range.to.valueOf().toString(),
            queries: queries,
          },
          // This sets up a cancel token
          requestId: options.requestId,
        })
        .then((res: any) => this.processQueryResult(queries, res));

      streams.push(from(req));
    }

    return merge(...streams);
  }

  processQueryResult(queries: any, res: any): DataQueryResponse {
    const data: TestData[] = [];

    for (const query of queries) {
      const results = res.data.results[query.refId];

      for (const t of results.tables || []) {
        const table = t as TableData;
        table.refId = query.refId;
        table.name = query.alias;
        data.push(table);
      }

      for (const series of results.series || []) {
        data.push({ target: series.name, datapoints: series.points, refId: query.refId, tags: series.tags });
      }
    }

    return { data };
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

  metricFindQuery(query: string) {
    return new Promise<MetricFindValue[]>((resolve, reject) => {
      setTimeout(() => {
        const children = queryMetricTree(templateSrv.replace(query));
        const items = children.map(item => ({ value: item.name, text: item.name }));
        resolve(items);
      }, 100);
    });
  }
}
