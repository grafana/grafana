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
import { StreamHandler } from './StreamHandler';
import { queryMetricTree } from './metricTree';
import { of } from 'rxjs';
import { runStreams, hasStreamingClientQuery } from './runStreams';
import templateSrv from 'app/features/templating/template_srv';

type TestData = TimeSeries | TableData;

export interface TestDataRegistry {
  [key: string]: TestData[];
}

export class TestDataDataSource extends DataSourceApi<TestDataQuery> {
  streams = new StreamHandler();

  /** @ngInject */
  constructor(instanceSettings: DataSourceInstanceSettings) {
    super(instanceSettings);
  }

  query(options: DataQueryRequest<TestDataQuery>) {
    const queries = options.targets.map(item => {
      return {
        ...item,
        intervalMs: options.intervalMs,
        maxDataPoints: options.maxDataPoints,
        datasourceId: this.id,
        alias: templateSrv.replace(item.alias || ''),
      };
    });

    if (queries.length === 0) {
      return of({ data: [] });
    }

    if (hasStreamingClientQuery(options)) {
      return runStreams(queries, options);
    }

    return getBackendSrv()
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
      .then(res => this.processQueryResult(queries, res));
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
        data.push({ target: series.name, datapoints: series.points, refId: query.refId });
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
