import _ from 'lodash';
import { DataSourceApi, DataQueryRequest, TableData, TimeSeries } from '@grafana/ui';
import { TestDataQuery, Scenario } from './types';

type TestData = TimeSeries | TableData;

export interface TestDataRegistry {
  [key: string]: TestData[];
}

export class TestDataDatasource implements DataSourceApi<TestDataQuery> {
  id: number;

  /** @ngInject */
  constructor(instanceSettings, private backendSrv, private $q) {
    this.id = instanceSettings.id;
  }

  query(options: DataQueryRequest<TestDataQuery>) {
    const queries = _.filter(options.targets, item => {
      return item.hide !== true;
    }).map(item => {
      return {
        refId: item.refId,
        scenarioId: item.scenarioId,
        intervalMs: options.intervalMs,
        maxDataPoints: options.maxDataPoints,
        stringInput: item.stringInput,
        points: item.points,
        alias: item.alias,
        datasourceId: this.id,
      };
    });

    if (queries.length === 0) {
      return this.$q.when({ data: [] });
    }

    return this.backendSrv
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
      .then((res: any) => {
        const data: TestData[] = [];

        // Returns data in the order it was asked for.
        // if the response has data with different refId, it is ignored
        for (const query of queries) {
          const results = res.data.results[query.refId];
          if (!results) {
            console.warn('No Results for:', query);
            continue;
          }

          for (const t of results.tables || []) {
            const table = t as TableData;
            table.refId = query.refId;
            data.push(table);
          }

          for (const series of results.series || []) {
            data.push({ target: series.name, datapoints: series.points, refId: query.refId });
          }
        }

        return { data: data };
      });
  }

  annotationQuery(options) {
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
    return this.$q.when(events);
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
    return this.backendSrv.get('/api/tsdb/testdata/scenarios');
  }
}
