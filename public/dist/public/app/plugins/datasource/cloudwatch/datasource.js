import { __awaiter } from "tslib";
import { cloneDeep, find, isEmpty } from 'lodash';
import { merge, of } from 'rxjs';
import { LoadingState, } from '@grafana/data';
import { DataSourceWithBackend } from '@grafana/runtime';
import { getTimeSrv } from 'app/features/dashboard/services/TimeSrv';
import { getTemplateSrv } from 'app/features/templating/template_srv';
import { CloudWatchAnnotationSupport } from './annotationSupport';
import { DEFAULT_METRICS_QUERY, getDefaultLogsQuery } from './defaultQueries';
import { isCloudWatchAnnotationQuery, isCloudWatchLogsQuery, isCloudWatchMetricsQuery } from './guards';
import { CloudWatchLogsLanguageProvider } from './language/cloudwatch-logs/CloudWatchLogsLanguageProvider';
import { SQLCompletionItemProvider } from './language/cloudwatch-sql/completion/CompletionItemProvider';
import { LogsCompletionItemProvider } from './language/logs/completion/CompletionItemProvider';
import { MetricMathCompletionItemProvider } from './language/metric-math/completion/CompletionItemProvider';
import { CloudWatchAnnotationQueryRunner } from './query-runner/CloudWatchAnnotationQueryRunner';
import { CloudWatchLogsQueryRunner } from './query-runner/CloudWatchLogsQueryRunner';
import { CloudWatchMetricsQueryRunner } from './query-runner/CloudWatchMetricsQueryRunner';
import { ResourcesAPI } from './resources/ResourcesAPI';
import { CloudWatchVariableSupport } from './variables';
export class CloudWatchDatasource extends DataSourceWithBackend {
    constructor(instanceSettings, templateSrv = getTemplateSrv(), timeSrv = getTimeSrv()) {
        super(instanceSettings);
        this.instanceSettings = instanceSettings;
        this.templateSrv = templateSrv;
        this.type = 'cloudwatch';
        this.getLogRowContext = (row, context, query) => __awaiter(this, void 0, void 0, function* () {
            return this.logsQueryRunner.getLogRowContext(row, context, query);
        });
        this.defaultRegion = instanceSettings.jsonData.defaultRegion;
        this.resources = new ResourcesAPI(instanceSettings, templateSrv);
        this.languageProvider = new CloudWatchLogsLanguageProvider(this);
        this.sqlCompletionItemProvider = new SQLCompletionItemProvider(this.resources, this.templateSrv);
        this.metricMathCompletionItemProvider = new MetricMathCompletionItemProvider(this.resources, this.templateSrv);
        this.metricsQueryRunner = new CloudWatchMetricsQueryRunner(instanceSettings, templateSrv);
        this.logsCompletionItemProvider = new LogsCompletionItemProvider(this.resources, this.templateSrv);
        this.logsQueryRunner = new CloudWatchLogsQueryRunner(instanceSettings, templateSrv, timeSrv);
        this.annotationQueryRunner = new CloudWatchAnnotationQueryRunner(instanceSettings, templateSrv);
        this.variables = new CloudWatchVariableSupport(this.resources);
        this.annotations = CloudWatchAnnotationSupport;
        this.defaultLogGroups = instanceSettings.jsonData.defaultLogGroups;
    }
    filterQuery(query) {
        return query.hide !== true || (isCloudWatchMetricsQuery(query) && query.id !== '');
    }
    query(options) {
        options = cloneDeep(options);
        let queries = options.targets.filter(this.filterQuery);
        const logQueries = [];
        const metricsQueries = [];
        const annotationQueries = [];
        queries.forEach((query) => {
            if (isCloudWatchAnnotationQuery(query)) {
                annotationQueries.push(query);
            }
            else if (isCloudWatchLogsQuery(query)) {
                logQueries.push(query);
            }
            else {
                metricsQueries.push(query);
            }
        });
        const dataQueryResponses = [];
        if (logQueries.length) {
            dataQueryResponses.push(this.logsQueryRunner.handleLogQueries(logQueries, options));
        }
        if (metricsQueries.length) {
            dataQueryResponses.push(this.metricsQueryRunner.handleMetricQueries(metricsQueries, options));
        }
        if (annotationQueries.length) {
            dataQueryResponses.push(this.annotationQueryRunner.handleAnnotationQuery(annotationQueries, options));
        }
        // No valid targets, return the empty result to save a round trip.
        if (isEmpty(dataQueryResponses)) {
            return of({
                data: [],
                state: LoadingState.Done,
            });
        }
        return merge(...dataQueryResponses);
    }
    interpolateVariablesInQueries(queries, scopedVars) {
        if (!queries.length) {
            return queries;
        }
        return queries.map((query) => (Object.assign(Object.assign(Object.assign({}, query), { region: this.metricsQueryRunner.replaceVariableAndDisplayWarningIfMulti(this.getActualRegion(query.region), scopedVars) }), (isCloudWatchMetricsQuery(query) &&
            this.metricsQueryRunner.interpolateMetricsQueryVariables(query, scopedVars)))));
    }
    targetContainsTemplate(target) {
        var _a;
        return (this.templateSrv.containsTemplate(target.region) ||
            this.templateSrv.containsTemplate(target.namespace) ||
            this.templateSrv.containsTemplate(target.metricName) ||
            this.templateSrv.containsTemplate(target.expression) ||
            ((_a = target.logGroupNames) === null || _a === void 0 ? void 0 : _a.some((logGroup) => this.templateSrv.containsTemplate(logGroup))) ||
            find(target.dimensions, (v, k) => this.templateSrv.containsTemplate(k) || this.templateSrv.containsTemplate(v)));
    }
    showContextToggle() {
        return true;
    }
    getQueryDisplayText(query) {
        var _a;
        if (isCloudWatchLogsQuery(query)) {
            return (_a = query.expression) !== null && _a !== void 0 ? _a : '';
        }
        else {
            return JSON.stringify(query);
        }
    }
    // public
    getVariables() {
        return this.resources.getVariables();
    }
    getActualRegion(region) {
        var _a;
        if (region === 'default' || region === undefined || region === '') {
            return (_a = this.defaultRegion) !== null && _a !== void 0 ? _a : '';
        }
        return region;
    }
    getDefaultQuery(_) {
        return Object.assign(Object.assign({}, getDefaultLogsQuery(this.instanceSettings.jsonData.logGroups, this.instanceSettings.jsonData.defaultLogGroups)), DEFAULT_METRICS_QUERY);
    }
}
//# sourceMappingURL=datasource.js.map