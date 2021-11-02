import { __assign, __extends, __read, __spreadArray, __values } from "tslib";
import { from, merge, of } from 'rxjs';
import { delay } from 'rxjs/operators';
import { ArrayDataFrame, DataTopic, LiveChannelScope, LoadingState, } from '@grafana/data';
import { DataSourceWithBackend, getBackendSrv, getGrafanaLiveSrv, getTemplateSrv } from '@grafana/runtime';
import { queryMetricTree } from './metricTree';
import { runStream } from './runStreams';
import { getSearchFilterScopedVar } from 'app/features/variables/utils';
import { TestDataVariableSupport } from './variables';
import { generateRandomNodes, savedNodesResponse } from './nodeGraphUtils';
var TestDataDataSource = /** @class */ (function (_super) {
    __extends(TestDataDataSource, _super);
    function TestDataDataSource(instanceSettings, templateSrv) {
        if (templateSrv === void 0) { templateSrv = getTemplateSrv(); }
        var _this = _super.call(this, instanceSettings) || this;
        _this.templateSrv = templateSrv;
        _this.variables = new TestDataVariableSupport();
        return _this;
    }
    TestDataDataSource.prototype.query = function (options) {
        var e_1, _a, e_2, _b;
        var backendQueries = [];
        var streams = [];
        try {
            // Start streams and prepare queries
            for (var _c = __values(options.targets), _d = _c.next(); !_d.done; _d = _c.next()) {
                var target = _d.value;
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
                        var csvContent = 'Time,Value\n';
                        if (target.points) {
                            try {
                                for (var _e = (e_2 = void 0, __values(target.points)), _f = _e.next(); !_f.done; _f = _e.next()) {
                                    var point = _f.value;
                                    csvContent += point[1] + "," + point[0] + "\n";
                                }
                            }
                            catch (e_2_1) { e_2 = { error: e_2_1 }; }
                            finally {
                                try {
                                    if (_f && !_f.done && (_b = _e.return)) _b.call(_e);
                                }
                                finally { if (e_2) throw e_2.error; }
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
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (_d && !_d.done && (_a = _c.return)) _a.call(_c);
            }
            finally { if (e_1) throw e_1.error; }
        }
        if (backendQueries.length) {
            var backendOpts = __assign(__assign({}, options), { targets: backendQueries });
            streams.push(_super.prototype.query.call(this, backendOpts));
        }
        if (streams.length === 0) {
            return of({ data: [] });
        }
        return merge.apply(void 0, __spreadArray([], __read(streams), false));
    };
    TestDataDataSource.prototype.resolveTemplateVariables = function (query, scopedVars) {
        query.labels = this.templateSrv.replace(query.labels, scopedVars);
    };
    TestDataDataSource.prototype.annotationDataTopicTest = function (target, req) {
        var events = this.buildFakeAnnotationEvents(req.range, 50);
        var dataFrame = new ArrayDataFrame(events);
        dataFrame.meta = { dataTopic: DataTopic.Annotations };
        return of({ key: target.refId, data: [dataFrame] }).pipe(delay(100));
    };
    TestDataDataSource.prototype.buildFakeAnnotationEvents = function (range, count) {
        var timeWalker = range.from.valueOf();
        var to = range.to.valueOf();
        var events = [];
        var step = (to - timeWalker) / count;
        for (var i = 0; i < count; i++) {
            events.push({
                time: timeWalker,
                text: 'This is the text, <a href="https://grafana.com">Grafana.com</a>',
                tags: ['text', 'server'],
            });
            timeWalker += step;
        }
        return events;
    };
    TestDataDataSource.prototype.annotationQuery = function (options) {
        return Promise.resolve(this.buildFakeAnnotationEvents(options.range, 10));
    };
    TestDataDataSource.prototype.getQueryDisplayText = function (query) {
        if (query.alias) {
            return query.scenarioId + ' as ' + query.alias;
        }
        return query.scenarioId;
    };
    TestDataDataSource.prototype.testDatasource = function () {
        return Promise.resolve({
            status: 'success',
            message: 'Data source is working',
        });
    };
    TestDataDataSource.prototype.getScenarios = function () {
        if (!this.scenariosCache) {
            this.scenariosCache = this.getResource('scenarios');
        }
        return this.scenariosCache;
    };
    TestDataDataSource.prototype.variablesQuery = function (target, options) {
        var _a;
        var query = (_a = target.stringInput) !== null && _a !== void 0 ? _a : '';
        var interpolatedQuery = this.templateSrv.replace(query, getSearchFilterScopedVar({ query: query, wildcardChar: '*', options: options.scopedVars }));
        var children = queryMetricTree(interpolatedQuery);
        var items = children.map(function (item) { return ({ value: item.name, text: item.name }); });
        var dataFrame = new ArrayDataFrame(items);
        return of({ data: [dataFrame] }).pipe(delay(100));
    };
    TestDataDataSource.prototype.nodesQuery = function (target, options) {
        var _a, _b;
        var type = ((_a = target.nodes) === null || _a === void 0 ? void 0 : _a.type) || 'random';
        var frames;
        switch (type) {
            case 'random':
                frames = generateRandomNodes((_b = target.nodes) === null || _b === void 0 ? void 0 : _b.count);
                break;
            case 'response':
                frames = savedNodesResponse();
                break;
            default:
                throw new Error("Unknown node_graph sub type " + type);
        }
        return of({ data: frames }).pipe(delay(100));
    };
    return TestDataDataSource;
}(DataSourceWithBackend));
export { TestDataDataSource };
function runGrafanaAPI(target, req) {
    var url = "/api/" + target.stringInput;
    return from(getBackendSrv()
        .get(url)
        .then(function (res) {
        var frame = new ArrayDataFrame(res);
        return {
            state: LoadingState.Done,
            data: [frame],
        };
    }));
}
var liveQueryCounter = 1000;
function runGrafanaLiveQuery(target, req) {
    if (!target.channel) {
        throw new Error("Missing channel config");
    }
    return getGrafanaLiveSrv().getDataStream({
        addr: {
            scope: LiveChannelScope.Plugin,
            namespace: 'testdata',
            path: target.channel,
        },
        key: "testStream." + liveQueryCounter++,
    });
}
//# sourceMappingURL=datasource.js.map