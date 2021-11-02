import { __assign, __awaiter, __generator } from "tslib";
import { isString } from 'lodash';
import { ALIGNMENT_PERIODS, SELECTORS } from './constants';
import { MetricFindQueryTypes } from './types';
import { extractServicesFromMetricDescriptors, getAggregationOptionsByMetric, getAlignmentOptionsByMetric, getLabelKeys, getMetricTypesByService, } from './functions';
var CloudMonitoringMetricFindQuery = /** @class */ (function () {
    function CloudMonitoringMetricFindQuery(datasource) {
        this.datasource = datasource;
    }
    CloudMonitoringMetricFindQuery.prototype.execute = function (query) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                try {
                    if (!query.projectName) {
                        query.projectName = this.datasource.getDefaultProject();
                    }
                    switch (query.selectedQueryType) {
                        case MetricFindQueryTypes.Projects:
                            return [2 /*return*/, this.handleProjectsQuery()];
                        case MetricFindQueryTypes.Services:
                            return [2 /*return*/, this.handleServiceQuery(query)];
                        case MetricFindQueryTypes.MetricTypes:
                            return [2 /*return*/, this.handleMetricTypesQuery(query)];
                        case MetricFindQueryTypes.LabelKeys:
                            return [2 /*return*/, this.handleLabelKeysQuery(query)];
                        case MetricFindQueryTypes.LabelValues:
                            return [2 /*return*/, this.handleLabelValuesQuery(query)];
                        case MetricFindQueryTypes.ResourceTypes:
                            return [2 /*return*/, this.handleResourceTypeQuery(query)];
                        case MetricFindQueryTypes.Aligners:
                            return [2 /*return*/, this.handleAlignersQuery(query)];
                        case MetricFindQueryTypes.AlignmentPeriods:
                            return [2 /*return*/, this.handleAlignmentPeriodQuery()];
                        case MetricFindQueryTypes.Aggregations:
                            return [2 /*return*/, this.handleAggregationQuery(query)];
                        case MetricFindQueryTypes.SLOServices:
                            return [2 /*return*/, this.handleSLOServicesQuery(query)];
                        case MetricFindQueryTypes.SLO:
                            return [2 /*return*/, this.handleSLOQuery(query)];
                        case MetricFindQueryTypes.Selectors:
                            return [2 /*return*/, this.handleSelectorQuery()];
                        default:
                            return [2 /*return*/, []];
                    }
                }
                catch (error) {
                    console.error("Could not run CloudMonitoringMetricFindQuery " + query, error);
                    return [2 /*return*/, []];
                }
                return [2 /*return*/];
            });
        });
    };
    CloudMonitoringMetricFindQuery.prototype.handleProjectsQuery = function () {
        return __awaiter(this, void 0, void 0, function () {
            var projects;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.datasource.getProjects()];
                    case 1:
                        projects = _a.sent();
                        return [2 /*return*/, projects.map(function (s) { return ({
                                text: s.label,
                                value: s.value,
                                expandable: true,
                            }); })];
                }
            });
        });
    };
    CloudMonitoringMetricFindQuery.prototype.handleServiceQuery = function (_a) {
        var projectName = _a.projectName;
        return __awaiter(this, void 0, void 0, function () {
            var metricDescriptors, services;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, this.datasource.getMetricTypes(projectName)];
                    case 1:
                        metricDescriptors = _b.sent();
                        services = extractServicesFromMetricDescriptors(metricDescriptors);
                        return [2 /*return*/, services.map(function (s) { return ({
                                text: s.serviceShortName,
                                value: s.service,
                                expandable: true,
                            }); })];
                }
            });
        });
    };
    CloudMonitoringMetricFindQuery.prototype.handleMetricTypesQuery = function (_a) {
        var selectedService = _a.selectedService, projectName = _a.projectName;
        return __awaiter(this, void 0, void 0, function () {
            var metricDescriptors;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        if (!selectedService) {
                            return [2 /*return*/, []];
                        }
                        return [4 /*yield*/, this.datasource.getMetricTypes(projectName)];
                    case 1:
                        metricDescriptors = _b.sent();
                        return [2 /*return*/, getMetricTypesByService(metricDescriptors, this.datasource.templateSrv.replace(selectedService)).map(function (s) { return ({
                                text: s.displayName,
                                value: s.type,
                                expandable: true,
                            }); })];
                }
            });
        });
    };
    CloudMonitoringMetricFindQuery.prototype.handleLabelKeysQuery = function (_a) {
        var selectedMetricType = _a.selectedMetricType, projectName = _a.projectName;
        return __awaiter(this, void 0, void 0, function () {
            var labelKeys;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        if (!selectedMetricType) {
                            return [2 /*return*/, []];
                        }
                        return [4 /*yield*/, getLabelKeys(this.datasource, selectedMetricType, projectName)];
                    case 1:
                        labelKeys = _b.sent();
                        return [2 /*return*/, labelKeys.map(this.toFindQueryResult)];
                }
            });
        });
    };
    CloudMonitoringMetricFindQuery.prototype.handleLabelValuesQuery = function (_a) {
        var selectedMetricType = _a.selectedMetricType, labelKey = _a.labelKey, projectName = _a.projectName;
        return __awaiter(this, void 0, void 0, function () {
            var refId, labels, interpolatedKey, values;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        if (!selectedMetricType) {
                            return [2 /*return*/, []];
                        }
                        refId = 'handleLabelValuesQuery';
                        return [4 /*yield*/, this.datasource.getLabels(selectedMetricType, refId, projectName, [labelKey])];
                    case 1:
                        labels = _b.sent();
                        interpolatedKey = this.datasource.templateSrv.replace(labelKey);
                        values = labels.hasOwnProperty(interpolatedKey) ? labels[interpolatedKey] : [];
                        return [2 /*return*/, values.map(this.toFindQueryResult)];
                }
            });
        });
    };
    CloudMonitoringMetricFindQuery.prototype.handleResourceTypeQuery = function (_a) {
        var _b, _c;
        var selectedMetricType = _a.selectedMetricType, projectName = _a.projectName;
        return __awaiter(this, void 0, void 0, function () {
            var refId, labels;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0:
                        if (!selectedMetricType) {
                            return [2 /*return*/, []];
                        }
                        refId = 'handleResourceTypeQueryQueryType';
                        return [4 /*yield*/, this.datasource.getLabels(selectedMetricType, refId, projectName)];
                    case 1:
                        labels = _d.sent();
                        return [2 /*return*/, (_c = (_b = labels['resource.type']) === null || _b === void 0 ? void 0 : _b.map(this.toFindQueryResult)) !== null && _c !== void 0 ? _c : []];
                }
            });
        });
    };
    CloudMonitoringMetricFindQuery.prototype.handleAlignersQuery = function (_a) {
        var selectedMetricType = _a.selectedMetricType, projectName = _a.projectName;
        return __awaiter(this, void 0, void 0, function () {
            var metricDescriptors, descriptor;
            var _this = this;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        if (!selectedMetricType) {
                            return [2 /*return*/, []];
                        }
                        return [4 /*yield*/, this.datasource.getMetricTypes(projectName)];
                    case 1:
                        metricDescriptors = _b.sent();
                        descriptor = metricDescriptors.find(function (m) { return m.type === _this.datasource.templateSrv.replace(selectedMetricType); });
                        if (!descriptor) {
                            return [2 /*return*/, []];
                        }
                        return [2 /*return*/, getAlignmentOptionsByMetric(descriptor.valueType, descriptor.metricKind).map(this.toFindQueryResult)];
                }
            });
        });
    };
    CloudMonitoringMetricFindQuery.prototype.handleAggregationQuery = function (_a) {
        var selectedMetricType = _a.selectedMetricType, projectName = _a.projectName;
        return __awaiter(this, void 0, void 0, function () {
            var metricDescriptors, descriptor;
            var _this = this;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        if (!selectedMetricType) {
                            return [2 /*return*/, []];
                        }
                        return [4 /*yield*/, this.datasource.getMetricTypes(projectName)];
                    case 1:
                        metricDescriptors = _b.sent();
                        descriptor = metricDescriptors.find(function (m) { return m.type === _this.datasource.templateSrv.replace(selectedMetricType); });
                        if (!descriptor) {
                            return [2 /*return*/, []];
                        }
                        return [2 /*return*/, getAggregationOptionsByMetric(descriptor.valueType, descriptor.metricKind).map(this.toFindQueryResult)];
                }
            });
        });
    };
    CloudMonitoringMetricFindQuery.prototype.handleSLOServicesQuery = function (_a) {
        var projectName = _a.projectName;
        return __awaiter(this, void 0, void 0, function () {
            var services;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, this.datasource.getSLOServices(projectName)];
                    case 1:
                        services = _b.sent();
                        return [2 /*return*/, services.map(this.toFindQueryResult)];
                }
            });
        });
    };
    CloudMonitoringMetricFindQuery.prototype.handleSLOQuery = function (_a) {
        var selectedSLOService = _a.selectedSLOService, projectName = _a.projectName;
        return __awaiter(this, void 0, void 0, function () {
            var slos;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, this.datasource.getServiceLevelObjectives(projectName, selectedSLOService)];
                    case 1:
                        slos = _b.sent();
                        return [2 /*return*/, slos.map(this.toFindQueryResult)];
                }
            });
        });
    };
    CloudMonitoringMetricFindQuery.prototype.handleSelectorQuery = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, SELECTORS.map(this.toFindQueryResult)];
            });
        });
    };
    CloudMonitoringMetricFindQuery.prototype.handleAlignmentPeriodQuery = function () {
        return ALIGNMENT_PERIODS.map(this.toFindQueryResult);
    };
    CloudMonitoringMetricFindQuery.prototype.toFindQueryResult = function (x) {
        return isString(x) ? { text: x, expandable: true } : __assign(__assign({}, x), { expandable: true });
    };
    return CloudMonitoringMetricFindQuery;
}());
export default CloudMonitoringMetricFindQuery;
//# sourceMappingURL=CloudMonitoringMetricFindQuery.js.map