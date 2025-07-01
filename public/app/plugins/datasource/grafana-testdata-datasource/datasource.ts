import { from, merge, Observable, of, throwError } from 'rxjs';
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
  toDataFrame,
  MutableDataFrame,
  AnnotationQuery,
  getSearchFilterScopedVar,
  FieldType,
} from '@grafana/data';
import { DataSourceWithBackend, getBackendSrv, getGrafanaLiveSrv, getTemplateSrv, TemplateSrv } from '@grafana/runtime';

import { Scenario, TestDataDataQuery, TestDataQueryType } from './dataquery';
import { queryMetricTree } from './metricTree';
import { generateRandomEdges, generateRandomNodes, generateShowcaseData, savedNodesResponse } from './nodeGraphUtils';
import { runStream } from './runStreams';
import { flameGraphData, flameGraphDataDiff } from './testData/flameGraphResponse';
import { TestDataVariableSupport } from './variables';

export class TestDataDataSource extends DataSourceWithBackend<TestDataDataQuery> {
  scenariosCache?: Promise<Scenario[]>;

  constructor(
    instanceSettings: DataSourceInstanceSettings,
    private readonly templateSrv: TemplateSrv = getTemplateSrv()
  ) {
    super(instanceSettings);
    this.variables = new TestDataVariableSupport();
    this.annotations = {
      getDefaultQuery: () => ({ scenarioId: TestDataQueryType.Annotations, lines: 10 }),

      // Make sure annotations have scenarioId set
      prepareAnnotation: (old: AnnotationQuery<TestDataDataQuery>) => {
        if (old.target?.scenarioId?.length) {
          return old;
        }
        return {
          ...old,
          target: {
            refId: 'Anno',
            scenarioId: TestDataQueryType.Annotations,
            lines: 10,
          },
        };
      },
    };
  }

  getDefaultQuery(): Partial<TestDataDataQuery> {
    return {
      scenarioId: TestDataQueryType.RandomWalk,
      seriesCount: 1,
    };
  }

  query(options: DataQueryRequest<TestDataDataQuery>): Observable<DataQueryResponse> {
    const backendQueries: TestDataDataQuery[] = [];
    const streams: Array<Observable<DataQueryResponse>> = [];

    // Start streams and prepare queries
    for (let target of options.targets) {
      if (target.hide) {
        continue;
      }

      target = this.resolveTemplateVariables(target, options.scopedVars);

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
        case TestDataQueryType.Annotations:
          streams.push(this.annotationDataTopicTest(target, options));
          break;
        case 'variables-query':
          streams.push(this.variablesQuery(target, options));
          break;
        case 'node_graph':
          streams.push(this.nodesQuery(target, options));
          break;
        case 'flame_graph':
          streams.push(this.flameGraphQuery(target));
          break;
        case 'steps':
          streams.push(this.stepsQuery(target));
          break;
        case 'trace':
          streams.push(this.trace(options));
          break;
        case 'raw_frame':
          streams.push(this.rawFrameQuery(target, options));
          break;
        case 'server_error_500':
          // this now has an option where it can return/throw an error from the frontend.
          // if it doesn't, send it to the backend where it might panic there :)
          const query = this.serverErrorQuery(target, options);
          query ? streams.push(query) : backendQueries.push(target);
          break;
        // Unusable since 7, removed in 8
        case 'manual_entry': {
          let csvContent = 'Time,Value\n';
          if (target.points) {
            for (const point of target.points) {
              csvContent += `${point[1]},${point[0]}\n`;
            }
          }
          target.scenarioId = TestDataQueryType.CSVContent;
          target.csvContent = csvContent;
        }

        default:
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

  resolveTemplateVariables(query: TestDataDataQuery, scopedVars: ScopedVars) {
    const result = { ...query };

    if (result.labels) {
      result.labels = this.templateSrv.replace(result.labels, scopedVars);
    }
    if (result.alias) {
      result.alias = this.templateSrv.replace(result.alias, scopedVars);
    }
    if (result.scenarioId) {
      result.scenarioId = this.templateSrv.replace(result.scenarioId, scopedVars) as TestDataQueryType;
    }
    if (result.stringInput) {
      result.stringInput = this.templateSrv.replace(result.stringInput, scopedVars);
    }
    if (result.csvContent) {
      result.csvContent = this.templateSrv.replace(result.csvContent, scopedVars);
    }
    if (result.rawFrameContent) {
      result.rawFrameContent = this.templateSrv.replace(result.rawFrameContent, scopedVars);
    }

    return result;
  }

  applyTemplateVariables(query: TestDataDataQuery, scopedVars: ScopedVars): TestDataDataQuery {
    return this.resolveTemplateVariables(query, scopedVars);
  }

  annotationDataTopicTest(
    target: TestDataDataQuery,
    req: DataQueryRequest<TestDataDataQuery>
  ): Observable<DataQueryResponse> {
    const events = this.buildFakeAnnotationEvents(req.range, target.lines ?? 10);
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

  getQueryDisplayText(query: TestDataDataQuery) {
    const scenario = query.scenarioId ?? 'Default scenario';

    if (query.alias) {
      return scenario + ' as ' + query.alias;
    }

    return scenario;
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

  variablesQuery(
    target: TestDataDataQuery,
    options: DataQueryRequest<TestDataDataQuery>
  ): Observable<DataQueryResponse> {
    const query = target.stringInput ?? '';
    const interpolatedQuery = this.templateSrv.replace(query, getSearchFilterScopedVar({ query, wildcardChar: '*' }));
    const children = queryMetricTree(interpolatedQuery);
    const items = children.map((item) => ({ value: item.name, text: item.name }));
    const dataFrame = new ArrayDataFrame(items);

    return of({ data: [dataFrame] }).pipe(delay(100));
  }

  nodesQuery(target: TestDataDataQuery, options: DataQueryRequest<TestDataDataQuery>): Observable<DataQueryResponse> {
    const type = target.nodes?.type || 'random';
    let frames: DataFrame[];
    switch (type) {
      case 'feature_showcase':
        frames = generateShowcaseData();
        break;
      case 'random':
        frames = generateRandomNodes(target.nodes?.count, target.nodes?.seed);
        break;
      case 'response_small':
        frames = savedNodesResponse('small');
        break;
      case 'response_medium':
        frames = savedNodesResponse('medium');
        break;
      case 'random edges':
        frames = [generateRandomEdges(target.nodes?.count, target.nodes?.seed)];
        break;
      default:
        throw new Error(`Unknown node_graph sub type ${type}`);
    }

    return of({ data: frames }).pipe(delay(100));
  }

  flameGraphQuery(target: TestDataDataQuery): Observable<DataQueryResponse> {
    const data = target.flamegraphDiff ? flameGraphDataDiff : flameGraphData;
    return of({ data: [{ ...data, refId: target.refId }] }).pipe(delay(100));
  }

  trace(options: DataQueryRequest<TestDataDataQuery>): Observable<DataQueryResponse> {
    const frame = new MutableDataFrame({
      meta: {
        preferredVisualisationType: 'trace',
      },
      fields: [
        { name: 'traceID' },
        { name: 'spanID' },
        { name: 'parentSpanID' },
        { name: 'operationName' },
        { name: 'serviceName' },
        { name: 'serviceTags' },
        { name: 'startTime' },
        { name: 'duration' },
        { name: 'logs' },
        { name: 'references' },
        { name: 'tags' },
        { name: 'kind' },
        { name: 'statusCode' },
      ],
    });
    const numberOfSpans = options.targets[0].spanCount || 10;
    const spanIdPrefix = '75c665dfb68';
    const start = Date.now() - 1000 * 60 * 30;
    const kinds = ['client', 'server', ''];
    const statusCodes = [0, 1, 2];

    for (let i = 0; i < numberOfSpans; i++) {
      frame.add({
        traceID: spanIdPrefix + '10000',
        spanID: spanIdPrefix + (10000 + i),
        parentSpanID: i === 0 ? '' : spanIdPrefix + 10000,
        operationName: `Operation ${i}`,
        serviceName: `Service ${i}`,
        startTime: start + i * 100,
        duration: 300,
        tags: [
          { key: 'http.method', value: 'POST' },
          { key: 'http.status_code', value: 200 },
          { key: 'http.url', value: `Service${i}:80` },
        ],
        serviceTags: [
          { key: 'client-uuid', value: '6238bacefsecba865' },
          { key: 'service.name', value: `Service${i}` },
          { key: 'ip', value: '0.0.0.1' },
          { key: 'latest_version', value: false },
        ],
        logs:
          i % 4 === 0
            ? [
                { timestamp: start + i * 100, fields: [{ key: 'msg', value: 'Service updated' }] },
                { timestamp: start + i * 100 + 200, fields: [{ key: 'host', value: 'app' }] },
              ]
            : [],
        kind: i === 0 ? 'client' : kinds[Math.floor(Math.random() * kinds.length)],
        statusCode: statusCodes[Math.floor(Math.random() * statusCodes.length)],
      });
    }

    return of({ data: [frame] }).pipe(delay(100));
  }

  rawFrameQuery(
    target: TestDataDataQuery,
    options: DataQueryRequest<TestDataDataQuery>
  ): Observable<DataQueryResponse> {
    try {
      const data = JSON.parse(target.rawFrameContent ?? '[]').map((v: any) => {
        const f = toDataFrame(v);
        f.refId = target.refId;
        return f;
      });
      return of({ data, state: LoadingState.Done }).pipe(delay(100));
    } catch (ex) {
      return of({
        data: [],
        error: ex instanceof Error ? ex : new Error('Unkown error'),
      }).pipe(delay(100));
    }
  }

  // Incremented with each refresh in a step query
  step = 0;

  stepsQuery(target: TestDataDataQuery): Observable<DataQueryResponse> {
    let steps = (target.csvContent ?? `a\n,b\nc\n`)
      .split('\n')
      .map((v) => v.trim())
      .filter((v) => Boolean(v.length));

    this.step = this.step % steps.length;
    const step = target.alias?.length ? target.alias : 'step';

    const frame: DataFrame = {
      refId: target.refId,
      fields: [
        { name: 'time', type: FieldType.time, values: [Date.now()], config: {} },
        { name: 'index', type: FieldType.number, values: [this.step], config: {} },
        { name: step, type: FieldType.string, values: [steps[this.step]], config: {} },
      ],
      length: 1,
    };
    for (let i = 0; i < steps.length; i++) {
      frame.fields.push({
        name: `${step}-${steps[i]}`,
        type: FieldType.boolean,
        values: [i <= this.step],
        config: {},
      });
    }
    this.step++;
    return of({ data: [frame] }).pipe(delay(50));
  }

  serverErrorQuery(
    target: TestDataDataQuery,
    options: DataQueryRequest<TestDataDataQuery>
  ): Observable<DataQueryResponse> | null {
    const { errorType } = target;

    if (errorType === 'server_panic') {
      return null;
    }

    const stringInput = target.stringInput ?? '';
    if (stringInput === '') {
      if (errorType === 'frontend_exception') {
        throw new Error('Scenario threw an exception in the frontend because the input was empty.');
      } else {
        return throwError(() => new Error('Scenario returned an error because the input was empty.'));
      }
    }

    return null;
  }
}

function runGrafanaAPI(
  target: TestDataDataQuery,
  req: DataQueryRequest<TestDataDataQuery>
): Observable<DataQueryResponse> {
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
  target: TestDataDataQuery,
  req: DataQueryRequest<TestDataDataQuery>
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
