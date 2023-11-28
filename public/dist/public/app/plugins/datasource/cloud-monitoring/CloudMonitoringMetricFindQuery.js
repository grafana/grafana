import { __awaiter } from "tslib";
import { isString } from 'lodash';
import { ALIGNMENT_PERIODS, SELECTORS } from './constants';
import { extractServicesFromMetricDescriptors, getAggregationOptionsByMetric, getAlignmentOptionsByMetric, getLabelKeys, getMetricTypesByService, } from './functions';
import { MetricFindQueryTypes } from './types/query';
export default class CloudMonitoringMetricFindQuery {
    constructor(datasource) {
        this.datasource = datasource;
    }
    execute(query) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                if (!query.projectName) {
                    query.projectName = this.datasource.getDefaultProject();
                }
                switch (query.selectedQueryType) {
                    case MetricFindQueryTypes.Projects:
                        return this.handleProjectsQuery();
                    case MetricFindQueryTypes.Services:
                        return this.handleServiceQuery(query);
                    case MetricFindQueryTypes.MetricTypes:
                        return this.handleMetricTypesQuery(query);
                    case MetricFindQueryTypes.LabelKeys:
                        return this.handleLabelKeysQuery(query);
                    case MetricFindQueryTypes.LabelValues:
                        return this.handleLabelValuesQuery(query);
                    case MetricFindQueryTypes.ResourceTypes:
                        return this.handleResourceTypeQuery(query);
                    case MetricFindQueryTypes.Aligners:
                        return this.handleAlignersQuery(query);
                    case MetricFindQueryTypes.AlignmentPeriods:
                        return this.handleAlignmentPeriodQuery();
                    case MetricFindQueryTypes.Aggregations:
                        return this.handleAggregationQuery(query);
                    case MetricFindQueryTypes.SLOServices:
                        return this.handleSLOServicesQuery(query);
                    case MetricFindQueryTypes.SLO:
                        return this.handleSLOQuery(query);
                    case MetricFindQueryTypes.Selectors:
                        return this.handleSelectorQuery();
                    default:
                        return [];
                }
            }
            catch (error) {
                console.error(`Could not run CloudMonitoringMetricFindQuery ${query}`, error);
                return [];
            }
        });
    }
    handleProjectsQuery() {
        return __awaiter(this, void 0, void 0, function* () {
            const projects = yield this.datasource.getProjects();
            return projects.map((s) => ({
                text: s.label,
                value: s.value,
                expandable: true,
            }));
        });
    }
    handleServiceQuery({ projectName }) {
        return __awaiter(this, void 0, void 0, function* () {
            const metricDescriptors = yield this.datasource.getMetricTypes(projectName);
            const services = extractServicesFromMetricDescriptors(metricDescriptors);
            return services.map((s) => ({
                text: s.serviceShortName,
                value: s.service,
                expandable: true,
            }));
        });
    }
    handleMetricTypesQuery({ selectedService, projectName }) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!selectedService) {
                return [];
            }
            const metricDescriptors = yield this.datasource.getMetricTypes(projectName);
            return getMetricTypesByService(metricDescriptors, this.datasource.templateSrv.replace(selectedService)).map((s) => ({
                text: s.displayName,
                value: s.type,
                expandable: true,
            }));
        });
    }
    handleLabelKeysQuery({ selectedMetricType, projectName }) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!selectedMetricType) {
                return [];
            }
            const labelKeys = yield getLabelKeys(this.datasource, selectedMetricType, projectName);
            return labelKeys.map(this.toFindQueryResult);
        });
    }
    handleLabelValuesQuery({ selectedMetricType, labelKey, projectName }) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!selectedMetricType) {
                return [];
            }
            const refId = 'handleLabelValuesQuery';
            // REDUCE_MEAN is needed so the groupBy is not ignored
            const labels = yield this.datasource.getLabels(selectedMetricType, refId, projectName, {
                groupBys: [labelKey],
                crossSeriesReducer: 'REDUCE_MEAN',
            });
            const interpolatedKey = this.datasource.templateSrv.replace(labelKey);
            const values = labels.hasOwnProperty(interpolatedKey) ? labels[interpolatedKey] : [];
            return values.map(this.toFindQueryResult);
        });
    }
    handleResourceTypeQuery({ selectedMetricType, projectName }) {
        var _a, _b;
        return __awaiter(this, void 0, void 0, function* () {
            if (!selectedMetricType) {
                return [];
            }
            const refId = 'handleResourceTypeQueryQueryType';
            const labels = yield this.datasource.getLabels(selectedMetricType, refId, projectName);
            return (_b = (_a = labels['resource.type']) === null || _a === void 0 ? void 0 : _a.map(this.toFindQueryResult)) !== null && _b !== void 0 ? _b : [];
        });
    }
    handleAlignersQuery({ selectedMetricType, projectName }) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!selectedMetricType) {
                return [];
            }
            const metricDescriptors = yield this.datasource.getMetricTypes(projectName);
            const descriptor = metricDescriptors.find((m) => m.type === this.datasource.templateSrv.replace(selectedMetricType));
            if (!descriptor) {
                return [];
            }
            return getAlignmentOptionsByMetric(descriptor.valueType, descriptor.metricKind).map(this.toFindQueryResult);
        });
    }
    handleAggregationQuery({ selectedMetricType, projectName }) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!selectedMetricType) {
                return [];
            }
            const metricDescriptors = yield this.datasource.getMetricTypes(projectName);
            const descriptor = metricDescriptors.find((m) => m.type === this.datasource.templateSrv.replace(selectedMetricType));
            if (!descriptor) {
                return [];
            }
            return getAggregationOptionsByMetric(descriptor.valueType, descriptor.metricKind).map(this.toFindQueryResult);
        });
    }
    handleSLOServicesQuery({ projectName }) {
        return __awaiter(this, void 0, void 0, function* () {
            const services = yield this.datasource.getSLOServices(projectName);
            return services.map(this.toFindQueryResult);
        });
    }
    handleSLOQuery({ selectedSLOService, projectName }) {
        return __awaiter(this, void 0, void 0, function* () {
            const slos = yield this.datasource.getServiceLevelObjectives(projectName, selectedSLOService);
            return slos.map(this.toFindQueryResult);
        });
    }
    handleSelectorQuery() {
        return __awaiter(this, void 0, void 0, function* () {
            return SELECTORS.map(this.toFindQueryResult);
        });
    }
    handleAlignmentPeriodQuery() {
        return ALIGNMENT_PERIODS.map(this.toFindQueryResult);
    }
    toFindQueryResult(x) {
        return isString(x) ? { text: x, expandable: true } : Object.assign(Object.assign({}, x), { expandable: true });
    }
}
//# sourceMappingURL=CloudMonitoringMetricFindQuery.js.map