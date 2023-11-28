import { __awaiter, __rest } from "tslib";
import { isString } from 'lodash';
import { from, merge, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { DataFrameView, isValidLiveChannelAddress, MutableDataFrame, parseLiveChannelAddress, toDataFrame, dataFrameFromJSON, LoadingState, } from '@grafana/data';
import { DataSourceWithBackend, getBackendSrv, getDataSourceSrv, getGrafanaLiveSrv, getTemplateSrv, } from '@grafana/runtime';
import { migrateDatasourceNameToRef } from 'app/features/dashboard/state/DashboardMigrator';
import { getDashboardSrv } from '../../../features/dashboard/services/DashboardSrv';
import AnnotationQueryEditor from './components/AnnotationQueryEditor';
import { doTimeRegionQuery } from './timeRegions';
import { GrafanaAnnotationType, GrafanaQueryType } from './types';
let counter = 100;
export class GrafanaDatasource extends DataSourceWithBackend {
    constructor(instanceSettings) {
        super(instanceSettings);
        this.annotations = {
            QueryEditor: AnnotationQueryEditor,
            prepareAnnotation(json) {
                var _a, _b, _c, _d, _e;
                // Previously, these properties lived outside of target
                // This should handle migrating them
                json.target = (_a = json.target) !== null && _a !== void 0 ? _a : {
                    type: (_b = json.type) !== null && _b !== void 0 ? _b : GrafanaAnnotationType.Dashboard,
                    limit: (_c = json.limit) !== null && _c !== void 0 ? _c : 100,
                    tags: (_d = json.tags) !== null && _d !== void 0 ? _d : [],
                    matchAny: (_e = json.matchAny) !== null && _e !== void 0 ? _e : false,
                }; // using spread syntax caused an infinite loop in StandardAnnotationQueryEditor
                return json;
            },
            prepareQuery(anno) {
                let datasource = undefined;
                if (isString(anno.datasource)) {
                    const ref = migrateDatasourceNameToRef(anno.datasource, { returnDefaultAsNull: false });
                    if (ref) {
                        datasource = ref;
                    }
                }
                else {
                    datasource = anno.datasource;
                }
                // Filter from streaming query conflicts with filter from annotations
                const { filter } = anno, rest = __rest(anno, ["filter"]);
                return Object.assign(Object.assign({}, rest), { refId: anno.name, queryType: GrafanaQueryType.Annotations, datasource });
            },
        };
    }
    getDefaultQuery() {
        return {
            queryType: GrafanaQueryType.RandomWalk,
        };
    }
    query(request) {
        var _a, _b, _c;
        const results = [];
        const targets = [];
        const templateSrv = getTemplateSrv();
        for (const target of request.targets) {
            if (target.queryType === GrafanaQueryType.Annotations) {
                return from(this.getAnnotations({
                    range: request.range,
                    rangeRaw: request.range.raw,
                    annotation: target,
                    dashboard: getDashboardSrv().getCurrent(),
                }));
            }
            if (target.hide) {
                continue;
            }
            if (target.queryType === GrafanaQueryType.Snapshot) {
                results.push(of({
                    // NOTE refId is intentionally missing because:
                    // 1) there is only one snapshot
                    // 2) the payload will reference original refIds
                    data: ((_a = target.snapshot) !== null && _a !== void 0 ? _a : []).map((v) => dataFrameFromJSON(v)),
                    state: LoadingState.Done,
                }));
                continue;
            }
            if (target.queryType === GrafanaQueryType.TimeRegions) {
                const frame = doTimeRegionQuery('', target.timeRegion, request.range, request.timezone);
                results.push(of({
                    data: frame ? [frame] : [],
                    state: LoadingState.Done,
                }));
                continue;
            }
            if (target.queryType === GrafanaQueryType.LiveMeasurements) {
                let channel = templateSrv.replace(target.channel, request.scopedVars);
                const { filter } = target;
                const addr = parseLiveChannelAddress(channel);
                if (!isValidLiveChannelAddress(addr)) {
                    continue;
                }
                const buffer = {
                    maxLength: (_b = request.maxDataPoints) !== null && _b !== void 0 ? _b : 500,
                };
                if (target.buffer) {
                    buffer.maxDelta = target.buffer;
                    buffer.maxLength = buffer.maxLength * 2; //??
                }
                else if (((_c = request.rangeRaw) === null || _c === void 0 ? void 0 : _c.to) === 'now') {
                    buffer.maxDelta = request.range.to.valueOf() - request.range.from.valueOf();
                }
                results.push(getGrafanaLiveSrv().getDataStream({
                    key: `${request.requestId}.${counter++}`,
                    addr: addr,
                    filter,
                    buffer,
                }));
            }
            else {
                if (!target.queryType) {
                    target.queryType = GrafanaQueryType.RandomWalk;
                }
                targets.push(target);
            }
        }
        if (targets.length) {
            results.push(super.query(Object.assign(Object.assign({}, request), { targets })));
        }
        if (results.length) {
            // With a single query just return the results
            if (results.length === 1) {
                return results[0];
            }
            return merge(...results);
        }
        return of(); // nothing
    }
    listFiles(path) {
        return this.query({
            targets: [
                {
                    refId: 'A',
                    queryType: GrafanaQueryType.List,
                    path,
                },
            ],
        }).pipe(map((v) => {
            var _a;
            const frame = (_a = v.data[0]) !== null && _a !== void 0 ? _a : new MutableDataFrame();
            return new DataFrameView(frame);
        }));
    }
    metricFindQuery(options) {
        return Promise.resolve([]);
    }
    getAnnotations(options) {
        var _a, _b;
        return __awaiter(this, void 0, void 0, function* () {
            const query = options.annotation.target;
            if ((query === null || query === void 0 ? void 0 : query.queryType) === GrafanaQueryType.TimeRegions) {
                const frame = doTimeRegionQuery(options.annotation.name, query.timeRegion, options.range, (_a = getDashboardSrv().getCurrent()) === null || _a === void 0 ? void 0 : _a.timezone // Annotation queries don't include the timezone
                );
                return Promise.resolve({ data: frame ? [frame] : [] });
            }
            const annotation = options.annotation;
            const target = annotation.target;
            const params = {
                from: options.range.from.valueOf(),
                to: options.range.to.valueOf(),
                limit: target.limit,
                tags: target.tags,
                matchAny: target.matchAny,
            };
            if (target.type === GrafanaAnnotationType.Dashboard) {
                // if no dashboard id yet return
                if (!options.dashboard.uid) {
                    return Promise.resolve({ data: [] });
                }
                // filter by dashboard id
                params.dashboardUID = options.dashboard.uid;
                // remove tags filter if any
                delete params.tags;
            }
            else {
                // require at least one tag
                if (!Array.isArray(target.tags) || target.tags.length === 0) {
                    return Promise.resolve({ data: [] });
                }
                const templateSrv = getTemplateSrv();
                const delimiter = '__delimiter__';
                const tags = [];
                for (const t of params.tags) {
                    const renderedValues = templateSrv.replace(t, {}, (value) => {
                        if (typeof value === 'string') {
                            return value;
                        }
                        return value.join(delimiter);
                    });
                    for (const tt of renderedValues.split(delimiter)) {
                        tags.push(tt);
                    }
                }
                params.tags = tags;
            }
            const annotations = yield getBackendSrv().get('/api/annotations', params, `grafana-data-source-annotations-${annotation.name}-${(_b = options.dashboard) === null || _b === void 0 ? void 0 : _b.uid}`);
            return { data: [toDataFrame(annotations)] };
        });
    }
    testDatasource() {
        return Promise.resolve({ message: '', status: '' });
    }
}
/** Get the GrafanaDatasource instance */
export function getGrafanaDatasource() {
    return __awaiter(this, void 0, void 0, function* () {
        return (yield getDataSourceSrv().get('-- Grafana --'));
    });
}
//# sourceMappingURL=datasource.js.map