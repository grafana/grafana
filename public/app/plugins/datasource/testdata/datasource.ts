import _ from 'lodash';
import { DataSourceApi, DataQueryOptions, TableData, TimeSeries } from '@grafana/ui';
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

  query(options: DataQueryOptions<TestDataQuery>) {
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
      })
      .then(res => {
        const data: TestData[] = [];

        // Returns data in the order it was asked for.
        // if the response has data with different refId, it is ignored
        for (let i = 0; i < queries.length; i++) {
          const query = queries[i];
          const results = res.data.results[query.refId];
          if (results) {
            if (results.tables) {
              for (const table of results.tables) {
                data.push(table as TableData);
              }
            }
            if (results.series) {
              for (const series of results.series) {
                data.push({
                  target: series.name,
                  datapoints: series.points,
                });
              }
            }
          } else {
            console.warn('No Results for:', query);
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
