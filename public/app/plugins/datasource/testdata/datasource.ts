import { from, merge, Observable, of } from 'rxjs';
import { delay } from 'rxjs/operators';

import {
  AnnotationEvent,
  ArrayDataFrame,
  DataFrame,
  DataQueryRequest,
  DataQueryResponse,
  DataSourceInstanceSettings,
  DataTopic,
  LiveChannelScope,
  LoadingState,
  TimeRange,
  ScopedVars,
} from '@grafana/data';
import { Scenario, TestDataQuery } from './types';
import { DataSourceWithBackend, getBackendSrv, getGrafanaLiveSrv, getTemplateSrv, TemplateSrv } from '@grafana/runtime';
import { queryMetricTree } from './metricTree';
import { runStream } from './runStreams';
import { getSearchFilterScopedVar } from 'app/features/variables/utils';
import { TestDataVariableSupport } from './variables';
import { generateRandomNodes, savedNodesResponse } from './nodeGraphUtils';

export class TestDataDataSource extends DataSourceWithBackend<TestDataQuery> {
  scenariosCache?: Promise<Scenario[]>;

  constructor(
    instanceSettings: DataSourceInstanceSettings,
    private readonly templateSrv: TemplateSrv = getTemplateSrv()
  ) {
    super(instanceSettings);
    this.variables = new TestDataVariableSupport();
  }

  query(options: DataQueryRequest<TestDataQuery>): Observable<DataQueryResponse> {
    const backendQueries: TestDataQuery[] = [];
    const streams: Array<Observable<DataQueryResponse>> = [];

    // Start streams and prepare queries
    for (const target of options.targets) {
      if (target.hide) {
        continue;
      }

      this.resolveTemplateVariables(target, options.scopedVars);

      switch (target.scenarioId) {
        case 'live':
          streams.push(runGrafanaLiveQuery(target, options));
          break;
        case 'streaming_client':
          streams.push(runStream(target, options));
          break;
        case 'grafana_api':
          streams.push(runGrafanaAPI(target, options));
          break;
        case 'annotations':
          streams.push(this.annotationDataTopicTest(target, options));
          break;
        case 'variables-query':
          streams.push(this.variablesQuery(target, options));
          break;
        case 'node_graph':
          streams.push(this.nodesQuery(target, options));
          break;

        // Unusable since 7, removed in 8
        case 'manual_entry': {
          let csvContent = 'Time,Value\n';
          if ((target as any).points) {
            for (const point of (target as any).points) {
              csvContent += `${point[1]},${point[0]}\n`;
            }
          }
          target.scenarioId = 'csv_content';
          target.csvContent = csvContent;
        }

        default:
          if (target.alias) {
            target.alias = this.templateSrv.replace(target.alias, options.scopedVars);
          }

          backendQueries.push(target);
      }
    }

    if (backendQueries.length) {
      const backendOpts = {
        ...options,
        targets: backendQueries,
      };
      streams.push(super.query(backendOpts));
    }

    if (streams.length === 0) {
      return of({ data: [] });
    }

    return merge(...streams);
  }

  resolveTemplateVariables(query: TestDataQuery, scopedVars: ScopedVars) {
    query.labels = this.templateSrv.replace(query.labels!, scopedVars);
  }

  annotationDataTopicTest(target: TestDataQuery, req: DataQueryRequest<TestDataQuery>): Observable<DataQueryResponse> {
    const events = this.buildFakeAnnotationEvents(req.range, 10);
    const dataFrame = new ArrayDataFrame(events);
    dataFrame.meta = { dataTopic: DataTopic.Annotations };

    return of({ key: target.refId, data: [dataFrame] }).pipe(delay(100));
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
    if (!this.scenariosCache) {
      this.scenariosCache = this.getResource('scenarios');
    }

    return this.scenariosCache;
  }

  variablesQuery(target: TestDataQuery, options: DataQueryRequest<TestDataQuery>): Observable<DataQueryResponse> {
    const query = target.stringInput ?? '';
    const interpolatedQuery = this.templateSrv.replace(
      query,
      getSearchFilterScopedVar({ query, wildcardChar: '*', options: options.scopedVars })
    );
    const children = queryMetricTree(interpolatedQuery);
    const items = children.map((item) => ({ value: item.name, text: item.name }));
    const dataFrame = new ArrayDataFrame(items);

    return of({ data: [dataFrame] }).pipe(delay(100));
  }

  nodesQuery(target: TestDataQuery, options: DataQueryRequest<TestDataQuery>): Observable<DataQueryResponse> {
    const type = target.nodes?.type || 'random';
    let frames: DataFrame[];
    switch (type) {
      case 'random':
        frames = generateRandomNodes(target.nodes?.count);
        break;
      case 'response':
        frames = savedNodesResponse();
        break;
      default:
        throw new Error(`Unknown node_graph sub type ${type}`);
    }

    return of({ data: frames }).pipe(delay(100));
  }
}

function runGrafanaAPI(target: TestDataQuery, req: DataQueryRequest<TestDataQuery>): Observable<DataQueryResponse> {
  const url = `/api/${target.stringInput}`;
  return from(
    getBackendSrv()
      .get(url)
      .then((res) => {
        const frame = new ArrayDataFrame(res);
        return {
          state: LoadingState.Done,
          data: [frame],
        };
      })
  );
}

let liveQueryCounter = 1000;

function runGrafanaLiveQuery(
  target: TestDataQuery,
  req: DataQueryRequest<TestDataQuery>
): Observable<DataQueryResponse> {
  if (!target.channel) {
    throw new Error(`Missing channel config`);
  }
  return getGrafanaLiveSrv().getDataStream({
    addr: {
      scope: LiveChannelScope.Plugin,
      namespace: 'testdata',
      path: target.channel,
    },
    key: `testStream.${liveQueryCounter++}`,
  });
}
