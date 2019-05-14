import * as tslib_1 from "tslib";
import isString from 'lodash/isString';
import { alignmentPeriods } from './constants';
import { MetricFindQueryTypes } from './types';
import { getMetricTypesByService, getAlignmentOptionsByMetric, getAggregationOptionsByMetric, extractServicesFromMetricDescriptors, getLabelKeys, } from './functions';
var StackdriverMetricFindQuery = /** @class */ (function () {
    function StackdriverMetricFindQuery(datasource) {
        this.datasource = datasource;
    }
    StackdriverMetricFindQuery.prototype.execute = function (query) {
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            return tslib_1.__generator(this, function (_a) {
                try {
                    switch (query.selectedQueryType) {
                        case MetricFindQueryTypes.Services:
                            return [2 /*return*/, this.handleServiceQuery()];
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
                        default:
                            return [2 /*return*/, []];
                    }
                }
                catch (error) {
                    console.error("Could not run StackdriverMetricFindQuery " + query, error);
                    return [2 /*return*/, []];
                }
                return [2 /*return*/];
            });
        });
    };
    StackdriverMetricFindQuery.prototype.handleServiceQuery = function () {
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            var metricDescriptors, services;
            return tslib_1.__generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.datasource.getMetricTypes(this.datasource.projectName)];
                    case 1:
                        metricDescriptors = _a.sent();
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
    StackdriverMetricFindQuery.prototype.handleMetricTypesQuery = function (_a) {
        var selectedService = _a.selectedService;
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            var metricDescriptors;
            return tslib_1.__generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        if (!selectedService) {
                            return [2 /*return*/, []];
                        }
                        return [4 /*yield*/, this.datasource.getMetricTypes(this.datasource.projectName)];
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
    StackdriverMetricFindQuery.prototype.handleLabelKeysQuery = function (_a) {
        var selectedMetricType = _a.selectedMetricType;
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            var labelKeys;
            return tslib_1.__generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        if (!selectedMetricType) {
                            return [2 /*return*/, []];
                        }
                        return [4 /*yield*/, getLabelKeys(this.datasource, selectedMetricType)];
                    case 1:
                        labelKeys = _b.sent();
                        return [2 /*return*/, labelKeys.map(this.toFindQueryResult)];
                }
            });
        });
    };
    StackdriverMetricFindQuery.prototype.handleLabelValuesQuery = function (_a) {
        var selectedMetricType = _a.selectedMetricType, labelKey = _a.labelKey;
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            var refId, response, interpolatedKey, _b, name, values;
            return tslib_1.__generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        if (!selectedMetricType) {
                            return [2 /*return*/, []];
                        }
                        refId = 'handleLabelValuesQuery';
                        return [4 /*yield*/, this.datasource.getLabels(selectedMetricType, refId)];
                    case 1:
                        response = _c.sent();
                        interpolatedKey = this.datasource.templateSrv.replace(labelKey);
                        _b = tslib_1.__read(interpolatedKey.split('.').reverse(), 1), name = _b[0];
                        values = [];
                        if (response.meta && response.meta.metricLabels && response.meta.metricLabels.hasOwnProperty(name)) {
                            values = response.meta.metricLabels[name];
                        }
                        else if (response.meta && response.meta.resourceLabels && response.meta.resourceLabels.hasOwnProperty(name)) {
                            values = response.meta.resourceLabels[name];
                        }
                        return [2 /*return*/, values.map(this.toFindQueryResult)];
                }
            });
        });
    };
    StackdriverMetricFindQuery.prototype.handleResourceTypeQuery = function (_a) {
        var selectedMetricType = _a.selectedMetricType;
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            var refId, response;
            return tslib_1.__generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        if (!selectedMetricType) {
                            return [2 /*return*/, []];
                        }
                        refId = 'handleResourceTypeQueryQueryType';
                        return [4 /*yield*/, this.datasource.getLabels(selectedMetricType, refId)];
                    case 1:
                        response = _b.sent();
                        return [2 /*return*/, response.meta.resourceTypes ? response.meta.resourceTypes.map(this.toFindQueryResult) : []];
                }
            });
        });
    };
    StackdriverMetricFindQuery.prototype.handleAlignersQuery = function (_a) {
        var selectedMetricType = _a.selectedMetricType;
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            var metricDescriptors, _b, valueType, metricKind;
            var _this = this;
            return tslib_1.__generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        if (!selectedMetricType) {
                            return [2 /*return*/, []];
                        }
                        return [4 /*yield*/, this.datasource.getMetricTypes(this.datasource.projectName)];
                    case 1:
                        metricDescriptors = _c.sent();
                        _b = metricDescriptors.find(function (m) { return m.type === _this.datasource.templateSrv.replace(selectedMetricType); }), valueType = _b.valueType, metricKind = _b.metricKind;
                        return [2 /*return*/, getAlignmentOptionsByMetric(valueType, metricKind).map(this.toFindQueryResult)];
                }
            });
        });
    };
    StackdriverMetricFindQuery.prototype.handleAggregationQuery = function (_a) {
        var selectedMetricType = _a.selectedMetricType;
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            var metricDescriptors, _b, valueType, metricKind;
            var _this = this;
            return tslib_1.__generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        if (!selectedMetricType) {
                            return [2 /*return*/, []];
                        }
                        return [4 /*yield*/, this.datasource.getMetricTypes(this.datasource.projectName)];
                    case 1:
                        metricDescriptors = _c.sent();
                        _b = metricDescriptors.find(function (m) { return m.type === _this.datasource.templateSrv.replace(selectedMetricType); }), valueType = _b.valueType, metricKind = _b.metricKind;
                        return [2 /*return*/, getAggregationOptionsByMetric(valueType, metricKind).map(this.toFindQueryResult)];
                }
            });
        });
    };
    StackdriverMetricFindQuery.prototype.handleAlignmentPeriodQuery = function () {
        return alignmentPeriods.map(this.toFindQueryResult);
    };
    StackdriverMetricFindQuery.prototype.toFindQueryResult = function (x) {
        return isString(x) ? { text: x, expandable: true } : tslib_1.__assign({}, x, { expandable: true });
    };
    return StackdriverMetricFindQuery;
}());
export default StackdriverMetricFindQuery;
//# sourceMappingURL=StackdriverMetricFindQuery.js.map