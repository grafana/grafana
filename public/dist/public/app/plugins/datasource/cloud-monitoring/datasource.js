import { __awaiter, __rest } from "tslib";
import { chunk, flatten, isString, isArray, has, get, omit } from 'lodash';
import { from, lastValueFrom, of } from 'rxjs';
import { map, mergeMap } from 'rxjs/operators';
import { DataSourceWithBackend, getBackendSrv, toDataQueryResponse } from '@grafana/runtime';
import { getTimeSrv } from 'app/features/dashboard/services/TimeSrv';
import { getTemplateSrv } from 'app/features/templating/template_srv';
import { CloudMonitoringAnnotationSupport } from './annotationSupport';
import { SLO_BURN_RATE_SELECTOR_NAME } from './constants';
import { getMetricType, setMetricType } from './functions';
import { QueryType } from './types/query';
import { CloudMonitoringVariableSupport } from './variables';
export default class CloudMonitoringDatasource extends DataSourceWithBackend {
    constructor(instanceSettings, templateSrv = getTemplateSrv(), timeSrv = getTimeSrv()) {
        super(instanceSettings);
        this.instanceSettings = instanceSettings;
        this.templateSrv = templateSrv;
        this.timeSrv = timeSrv;
        this.authenticationType = instanceSettings.jsonData.authenticationType || 'jwt';
        this.variables = new CloudMonitoringVariableSupport(this);
        this.intervalMs = 0;
        this.annotations = CloudMonitoringAnnotationSupport(this);
        this.backendSrv = getBackendSrv();
    }
    getVariables() {
        return this.templateSrv.getVariables().map((v) => `$${v.name}`);
    }
    query(request) {
        request.targets = request.targets.map((t) => (Object.assign(Object.assign({}, this.migrateQuery(t)), { intervalMs: request.intervalMs })));
        return super.query(request);
    }
    applyTemplateVariables(target, scopedVars) {
        const { timeSeriesList, timeSeriesQuery, sloQuery, promQLQuery } = target;
        return Object.assign(Object.assign({}, target), { datasource: this.getRef(), intervalMs: this.intervalMs, timeSeriesList: timeSeriesList && Object.assign(Object.assign({}, this.interpolateProps(timeSeriesList, scopedVars)), { projectName: this.templateSrv.replace(timeSeriesList.projectName ? timeSeriesList.projectName : this.getDefaultProject(), scopedVars), filters: this.interpolateFilters(timeSeriesList.filters || [], scopedVars), groupBys: this.interpolateGroupBys(timeSeriesList.groupBys || [], scopedVars), view: timeSeriesList.view || 'FULL' }), timeSeriesQuery: timeSeriesQuery && Object.assign(Object.assign({}, this.interpolateProps(timeSeriesQuery, scopedVars)), { projectName: this.templateSrv.replace(timeSeriesQuery.projectName ? timeSeriesQuery.projectName : this.getDefaultProject(), scopedVars) }), sloQuery: sloQuery && this.interpolateProps(sloQuery, scopedVars), promQLQuery: promQLQuery && this.interpolateProps(promQLQuery, scopedVars) });
    }
    getLabels(metricType, refId, projectName, aggregation, timeRange) {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            const options = {
                targets: [
                    {
                        refId,
                        datasource: this.getRef(),
                        queryType: QueryType.TIME_SERIES_LIST,
                        timeSeriesList: setMetricType({
                            projectName: this.templateSrv.replace(projectName),
                            groupBys: this.interpolateGroupBys((aggregation === null || aggregation === void 0 ? void 0 : aggregation.groupBys) || [], {}),
                            crossSeriesReducer: (_a = aggregation === null || aggregation === void 0 ? void 0 : aggregation.crossSeriesReducer) !== null && _a !== void 0 ? _a : 'REDUCE_NONE',
                            view: 'HEADERS',
                        }, metricType),
                    },
                ],
                range: timeRange !== null && timeRange !== void 0 ? timeRange : this.timeSrv.timeRange(),
            };
            const queries = options.targets;
            if (!queries.length) {
                return lastValueFrom(of({ results: [] }));
            }
            return lastValueFrom(from(this.ensureGCEDefaultProject()).pipe(mergeMap(() => {
                return this.backendSrv.fetch({
                    url: '/api/ds/query',
                    method: 'POST',
                    headers: this.getRequestHeaders(),
                    data: {
                        from: options.range.from.valueOf().toString(),
                        to: options.range.to.valueOf().toString(),
                        queries,
                    },
                });
            }), map(({ data }) => {
                const dataQueryResponse = toDataQueryResponse({
                    data: data,
                });
                const labels = dataQueryResponse === null || dataQueryResponse === void 0 ? void 0 : dataQueryResponse.data.map((f) => { var _a, _b; return (_b = (_a = f.meta) === null || _a === void 0 ? void 0 : _a.custom) === null || _b === void 0 ? void 0 : _b.labels; }).filter((p) => !!p).reduce((acc, labels) => {
                    for (let key in labels) {
                        if (!acc[key]) {
                            acc[key] = new Set();
                        }
                        if (labels[key]) {
                            acc[key].add(labels[key]);
                        }
                    }
                    return acc;
                }, {});
                return Object.fromEntries(Object.entries(labels).map((l) => {
                    l[1] = Array.from(l[1]);
                    return l;
                }));
            })));
        });
    }
    getGCEDefaultProject() {
        return __awaiter(this, void 0, void 0, function* () {
            return this.getResource(`gceDefaultProject`);
        });
    }
    getDefaultProject() {
        const { defaultProject, authenticationType, gceDefaultProject } = this.instanceSettings.jsonData;
        if (authenticationType === 'gce') {
            return gceDefaultProject || '';
        }
        return defaultProject || '';
    }
    ensureGCEDefaultProject() {
        return __awaiter(this, void 0, void 0, function* () {
            const { authenticationType, gceDefaultProject } = this.instanceSettings.jsonData;
            if (authenticationType === 'gce' && !gceDefaultProject) {
                this.instanceSettings.jsonData.gceDefaultProject = yield this.getGCEDefaultProject();
            }
        });
    }
    getMetricTypes(projectName) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!projectName) {
                return [];
            }
            return this.getResource(`metricDescriptors/v3/projects/${this.templateSrv.replace(projectName)}/metricDescriptors`);
        });
    }
    filterMetricsByType(projectName, filter) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!projectName) {
                return [];
            }
            return this.getResource(`metricDescriptors/v3/projects/${this.templateSrv.replace(projectName)}/metricDescriptors`, { filter: `metric.type : "${filter}"` });
        });
    }
    getSLOServices(projectName) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.getResource(`services/v3/projects/${this.templateSrv.replace(projectName)}/services?pageSize=1000`);
        });
    }
    getServiceLevelObjectives(projectName, serviceId) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!serviceId) {
                return Promise.resolve([]);
            }
            let { projectName: p, serviceId: s } = this.interpolateProps({ projectName, serviceId });
            return this.getResource(`slo-services/v3/projects/${p}/services/${s}/serviceLevelObjectives`);
        });
    }
    getProjects() {
        return this.getResource(`projects`);
    }
    migrateMetricTypeFilter(metricType, filters) {
        const metricTypeFilterArray = ['metric.type', '=', metricType];
        if (filters === null || filters === void 0 ? void 0 : filters.length) {
            return filters.concat('AND', metricTypeFilterArray);
        }
        return metricTypeFilterArray;
    }
    // This is a manual port of the migration code in cloudmonitoring.go
    // DO NOT UPDATE THIS CODE WITHOUT UPDATING THE BACKEND CODE
    migrateQuery(query) {
        var _a;
        const _b = query, { hide, refId, datasource, key, queryType, maxLines, metric, intervalMs, type } = _b, rest = __rest(_b, ["hide", "refId", "datasource", "key", "queryType", "maxLines", "metric", "intervalMs", "type"]);
        if (!query.hasOwnProperty('metricQuery') &&
            !query.hasOwnProperty('sloQuery') &&
            !query.hasOwnProperty('timeSeriesQuery') &&
            !query.hasOwnProperty('timeSeriesList')) {
            return {
                datasource,
                key,
                refId,
                intervalMs,
                hide,
                queryType: type === 'annotationQuery' ? QueryType.ANNOTATION : QueryType.TIME_SERIES_LIST,
                timeSeriesList: Object.assign(Object.assign({}, rest), { view: rest.view || 'FULL' }),
            };
        }
        if (has(query, 'metricQuery') && ['metrics', QueryType.ANNOTATION].includes((_a = query.queryType) !== null && _a !== void 0 ? _a : '')) {
            const metricQuery = get(query, 'metricQuery');
            if (metricQuery.editorMode === 'mql') {
                query.timeSeriesQuery = {
                    projectName: metricQuery.projectName,
                    query: metricQuery.query,
                    graphPeriod: metricQuery.graphPeriod,
                };
                query.queryType = QueryType.TIME_SERIES_QUERY;
            }
            else {
                query.timeSeriesList = {
                    projectName: metricQuery.projectName,
                    crossSeriesReducer: metricQuery.crossSeriesReducer,
                    alignmentPeriod: metricQuery.alignmentPeriod,
                    perSeriesAligner: metricQuery.perSeriesAligner,
                    groupBys: metricQuery.groupBys,
                    filters: metricQuery.filters,
                    view: metricQuery.view,
                    preprocessor: metricQuery.preprocessor,
                };
                query.queryType = QueryType.TIME_SERIES_LIST;
                if (metricQuery.metricType) {
                    query.timeSeriesList.filters = this.migrateMetricTypeFilter(metricQuery.metricType, query.timeSeriesList.filters);
                }
            }
            query.aliasBy = metricQuery.aliasBy;
            query = omit(query, 'metricQuery');
        }
        if (query.queryType === QueryType.SLO && has(query, 'sloQuery.aliasBy')) {
            query.aliasBy = get(query, 'sloQuery.aliasBy');
            query = omit(query, 'sloQuery.aliasBy');
        }
        return query;
    }
    interpolateProps(object, scopedVars = {}) {
        return Object.entries(object).reduce((acc, [key, value]) => {
            return Object.assign(Object.assign({}, acc), { [key]: value && isString(value) ? this.templateSrv.replace(value, scopedVars) : value });
        }, {});
    }
    filterQuery(query) {
        if (query.hide) {
            return false;
        }
        if (query.queryType === QueryType.SLO) {
            if (!query.sloQuery) {
                return false;
            }
            const { selectorName, serviceId, sloId, projectName, lookbackPeriod } = query.sloQuery;
            return (!!selectorName &&
                !!serviceId &&
                !!sloId &&
                !!projectName &&
                (selectorName !== SLO_BURN_RATE_SELECTOR_NAME || !!lookbackPeriod));
        }
        if (query.queryType === QueryType.TIME_SERIES_QUERY) {
            return !!query.timeSeriesQuery && !!query.timeSeriesQuery.projectName && !!query.timeSeriesQuery.query;
        }
        if (query.queryType && [QueryType.TIME_SERIES_LIST, QueryType.ANNOTATION].includes(query.queryType)) {
            return !!query.timeSeriesList && !!query.timeSeriesList.projectName && !!getMetricType(query.timeSeriesList);
        }
        if (query.queryType === QueryType.PROMQL) {
            return (!!query.promQLQuery && !!query.promQLQuery.projectName && !!query.promQLQuery.expr && !!query.promQLQuery.step);
        }
        return false;
    }
    interpolateVariablesInQueries(queries, scopedVars) {
        return queries.map((query) => this.applyTemplateVariables(this.migrateQuery(query), scopedVars));
    }
    interpolateFilters(filters, scopedVars) {
        const completeFilter = chunk(filters, 4)
            .map(([key, operator, value, condition]) => (Object.assign({ key,
            operator,
            value }, (condition && { condition }))))
            .filter((item) => item.value);
        const filterArray = flatten(completeFilter.map(({ key, operator, value, condition }) => [
            this.templateSrv.replace(key, scopedVars || {}),
            operator,
            this.templateSrv.replace(value, scopedVars || {}, (value) => {
                return isArray(value) && value.length ? `(${value.join('|')})` : value;
            }),
            ...(condition ? [condition] : []),
        ]));
        return filterArray || [];
    }
    interpolateGroupBys(groupBys, scopedVars) {
        let interpolatedGroupBys = [];
        (groupBys || []).forEach((gb) => {
            const interpolated = this.templateSrv.replace(gb, scopedVars || {}, 'csv').split(',');
            if (Array.isArray(interpolated)) {
                interpolatedGroupBys = interpolatedGroupBys.concat(interpolated);
            }
            else {
                interpolatedGroupBys.push(interpolated);
            }
        });
        return interpolatedGroupBys;
    }
}
//# sourceMappingURL=datasource.js.map