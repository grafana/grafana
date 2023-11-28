import { from, merge, of, throwError } from 'rxjs';
import { delay } from 'rxjs/operators';
import { ArrayDataFrame, DataTopic, LiveChannelScope, LoadingState, toDataFrame, MutableDataFrame, getSearchFilterScopedVar, } from '@grafana/data';
import { DataSourceWithBackend, getBackendSrv, getGrafanaLiveSrv, getTemplateSrv } from '@grafana/runtime';
import { TestDataQueryType } from './dataquery.gen';
import { queryMetricTree } from './metricTree';
import { generateRandomEdges, generateRandomNodes, savedNodesResponse } from './nodeGraphUtils';
import { runStream } from './runStreams';
import { flameGraphData, flameGraphDataDiff } from './testData/flameGraphResponse';
import { TestDataVariableSupport } from './variables';
export class TestDataDataSource extends DataSourceWithBackend {
    constructor(instanceSettings, templateSrv = getTemplateSrv()) {
        super(instanceSettings);
        this.templateSrv = templateSrv;
        this.variables = new TestDataVariableSupport();
        this.annotations = {
            getDefaultQuery: () => ({ scenarioId: TestDataQueryType.Annotations, lines: 10 }),
            // Make sure annotations have scenarioId set
            prepareAnnotation: (old) => {
                var _a, _b;
                if ((_b = (_a = old.target) === null || _a === void 0 ? void 0 : _a.scenarioId) === null || _b === void 0 ? void 0 : _b.length) {
                    return old;
                }
                return Object.assign(Object.assign({}, old), { target: {
                        refId: 'Anno',
                        scenarioId: TestDataQueryType.Annotations,
                        lines: 10,
                    } });
            },
        };
    }
    getDefaultQuery() {
        return {
            scenarioId: TestDataQueryType.RandomWalk,
            seriesCount: 1,
        };
    }
    query(options) {
        const backendQueries = [];
        const streams = [];
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
                case 'trace':
                    streams.push(this.trace(target, options));
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
            const backendOpts = Object.assign(Object.assign({}, options), { targets: backendQueries });
            streams.push(super.query(backendOpts));
        }
        if (streams.length === 0) {
            return of({ data: [] });
        }
        return merge(...streams);
    }
    resolveTemplateVariables(query, scopedVars) {
        if (query.labels) {
            query.labels = this.templateSrv.replace(query.labels, scopedVars);
        }
        if (query.alias) {
            query.alias = this.templateSrv.replace(query.alias, scopedVars);
        }
        if (query.scenarioId) {
            query.scenarioId = this.templateSrv.replace(query.scenarioId, scopedVars);
        }
        if (query.stringInput) {
            query.stringInput = this.templateSrv.replace(query.stringInput, scopedVars);
        }
        if (query.csvContent) {
            query.csvContent = this.templateSrv.replace(query.csvContent, scopedVars);
        }
        if (query.rawFrameContent) {
            query.rawFrameContent = this.templateSrv.replace(query.rawFrameContent, scopedVars);
        }
    }
    applyTemplateVariables(query, scopedVars) {
        this.resolveTemplateVariables(query, scopedVars);
        return query;
    }
    annotationDataTopicTest(target, req) {
        var _a;
        const events = this.buildFakeAnnotationEvents(req.range, (_a = target.lines) !== null && _a !== void 0 ? _a : 10);
        const dataFrame = new ArrayDataFrame(events);
        dataFrame.meta = { dataTopic: DataTopic.Annotations };
        return of({ key: target.refId, data: [dataFrame] }).pipe(delay(100));
    }
    buildFakeAnnotationEvents(range, count) {
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
    getQueryDisplayText(query) {
        var _a;
        const scenario = (_a = query.scenarioId) !== null && _a !== void 0 ? _a : 'Default scenario';
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
    getScenarios() {
        if (!this.scenariosCache) {
            this.scenariosCache = this.getResource('scenarios');
        }
        return this.scenariosCache;
    }
    variablesQuery(target, options) {
        var _a;
        const query = (_a = target.stringInput) !== null && _a !== void 0 ? _a : '';
        const interpolatedQuery = this.templateSrv.replace(query, getSearchFilterScopedVar({ query, wildcardChar: '*' }));
        const children = queryMetricTree(interpolatedQuery);
        const items = children.map((item) => ({ value: item.name, text: item.name }));
        const dataFrame = new ArrayDataFrame(items);
        return of({ data: [dataFrame] }).pipe(delay(100));
    }
    nodesQuery(target, options) {
        var _a, _b, _c;
        const type = ((_a = target.nodes) === null || _a === void 0 ? void 0 : _a.type) || 'random';
        let frames;
        switch (type) {
            case 'random':
                frames = generateRandomNodes((_b = target.nodes) === null || _b === void 0 ? void 0 : _b.count);
                break;
            case 'response':
                frames = savedNodesResponse();
                break;
            case 'random edges':
                frames = [generateRandomEdges((_c = target.nodes) === null || _c === void 0 ? void 0 : _c.count)];
                break;
            default:
                throw new Error(`Unknown node_graph sub type ${type}`);
        }
        return of({ data: frames }).pipe(delay(100));
    }
    flameGraphQuery(target) {
        const data = target.flamegraphDiff ? flameGraphDataDiff : flameGraphData;
        return of({ data: [Object.assign(Object.assign({}, data), { refId: target.refId })] }).pipe(delay(100));
    }
    trace(target, options) {
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
            ],
        });
        const numberOfSpans = options.targets[0].spanCount || 10;
        const spanIdPrefix = '75c665dfb68';
        const start = Date.now() - 1000 * 60 * 30;
        for (let i = 0; i < numberOfSpans; i++) {
            frame.add({
                traceID: spanIdPrefix + '10000',
                spanID: spanIdPrefix + (10000 + i),
                parentSpanID: i === 0 ? '' : spanIdPrefix + 10000,
                operationName: `Operation ${i}`,
                serviceName: `Service ${i}`,
                startTime: start + i * 100,
                duration: 300,
            });
        }
        return of({ data: [frame] }).pipe(delay(100));
    }
    rawFrameQuery(target, options) {
        var _a;
        try {
            const data = JSON.parse((_a = target.rawFrameContent) !== null && _a !== void 0 ? _a : '[]').map((v) => {
                const f = toDataFrame(v);
                f.refId = target.refId;
                return f;
            });
            return of({ data, state: LoadingState.Done }).pipe(delay(100));
        }
        catch (ex) {
            return of({
                data: [],
                error: ex instanceof Error ? ex : new Error('Unkown error'),
            }).pipe(delay(100));
        }
    }
    serverErrorQuery(target, options) {
        var _a;
        const { errorType } = target;
        if (errorType === 'server_panic') {
            return null;
        }
        const stringInput = (_a = target.stringInput) !== null && _a !== void 0 ? _a : '';
        if (stringInput === '') {
            if (errorType === 'frontend_exception') {
                throw new Error('Scenario threw an exception in the frontend because the input was empty.');
            }
            else {
                return throwError(() => new Error('Scenario returned an error because the input was empty.'));
            }
        }
        return null;
    }
}
function runGrafanaAPI(target, req) {
    const url = `/api/${target.stringInput}`;
    return from(getBackendSrv()
        .get(url)
        .then((res) => {
        const frame = new ArrayDataFrame(res);
        return {
            state: LoadingState.Done,
            data: [frame],
        };
    }));
}
let liveQueryCounter = 1000;
function runGrafanaLiveQuery(target, req) {
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
//# sourceMappingURL=datasource.js.map