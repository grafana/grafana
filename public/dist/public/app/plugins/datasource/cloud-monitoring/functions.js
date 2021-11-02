import { __assign, __awaiter, __generator, __read, __spreadArray } from "tslib";
import { chunk, flatten, initial, startCase, uniqBy } from 'lodash';
import { ALIGNMENTS, AGGREGATIONS, SYSTEM_LABELS } from './constants';
import { getTemplateSrv } from '@grafana/runtime';
import { ValueTypes, MetricKind, AlignmentTypes, PreprocessorType } from './types';
var templateSrv = getTemplateSrv();
export var extractServicesFromMetricDescriptors = function (metricDescriptors) {
    return uniqBy(metricDescriptors, 'service');
};
export var getMetricTypesByService = function (metricDescriptors, service) {
    return metricDescriptors.filter(function (m) { return m.service === service; });
};
export var getMetricTypes = function (metricDescriptors, metricType, interpolatedMetricType, selectedService) {
    var metricTypes = getMetricTypesByService(metricDescriptors, selectedService).map(function (m) { return ({
        value: m.type,
        name: m.displayName,
    }); });
    var metricTypeExistInArray = metricTypes.some(function (m) { return m.value === interpolatedMetricType; });
    var metricTypeByService = metricTypes.length ? metricTypes[0].value : '';
    var selectedMetricType = metricTypeExistInArray ? metricType : metricTypeByService;
    return {
        metricTypes: metricTypes,
        selectedMetricType: selectedMetricType,
    };
};
export var getAlignmentOptionsByMetric = function (metricValueType, metricKind, preprocessor) {
    if (preprocessor && preprocessor === PreprocessorType.Rate) {
        metricKind = MetricKind.GAUGE;
    }
    return !metricValueType
        ? []
        : ALIGNMENTS.filter(function (i) {
            return (i.valueTypes.indexOf(metricValueType) !== -1 &&
                i.metricKinds.indexOf(metricKind) !== -1);
        });
};
export var getAggregationOptionsByMetric = function (valueType, metricKind) {
    return !metricKind
        ? []
        : AGGREGATIONS.filter(function (i) {
            return i.valueTypes.indexOf(valueType) !== -1 && i.metricKinds.indexOf(metricKind) !== -1;
        });
};
export var getLabelKeys = function (datasource, selectedMetricType, projectName) { return __awaiter(void 0, void 0, void 0, function () {
    var refId, labels;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                refId = 'handleLabelKeysQuery';
                return [4 /*yield*/, datasource.getLabels(selectedMetricType, refId, projectName)];
            case 1:
                labels = _a.sent();
                return [2 /*return*/, __spreadArray(__spreadArray([], __read(Object.keys(labels)), false), __read(SYSTEM_LABELS), false)];
        }
    });
}); };
export var getAlignmentPickerData = function (valueType, metricKind, perSeriesAligner, preprocessor) {
    if (valueType === void 0) { valueType = ValueTypes.DOUBLE; }
    if (metricKind === void 0) { metricKind = MetricKind.GAUGE; }
    if (perSeriesAligner === void 0) { perSeriesAligner = AlignmentTypes.ALIGN_MEAN; }
    var alignOptions = getAlignmentOptionsByMetric(valueType, metricKind, preprocessor).map(function (option) { return (__assign(__assign({}, option), { label: option.text })); });
    if (!alignOptions.some(function (o) { return o.value === templateSrv.replace(perSeriesAligner); })) {
        perSeriesAligner = alignOptions.length > 0 ? alignOptions[0].value : AlignmentTypes.ALIGN_MEAN;
    }
    return { alignOptions: alignOptions, perSeriesAligner: perSeriesAligner };
};
export var labelsToGroupedOptions = function (groupBys) {
    var groups = groupBys.reduce(function (acc, curr) {
        var arr = curr.split('.').map(startCase);
        var group = (arr.length === 2 ? arr : initial(arr)).join(' ');
        var option = {
            value: curr,
            label: curr,
        };
        if (acc[group]) {
            acc[group] = __spreadArray(__spreadArray([], __read(acc[group]), false), [option], false);
        }
        else {
            acc[group] = [option];
        }
        return acc;
    }, {});
    return Object.entries(groups).map(function (_a) {
        var _b = __read(_a, 2), label = _b[0], options = _b[1];
        return ({ label: label, options: options, expanded: true });
    }, []);
};
export var filtersToStringArray = function (filters) {
    var strArr = flatten(filters.map(function (_a) {
        var key = _a.key, operator = _a.operator, value = _a.value, condition = _a.condition;
        return [key, operator, value, condition];
    }));
    return strArr.filter(function (_, i) { return i !== strArr.length - 1; });
};
export var stringArrayToFilters = function (filterArray) {
    return chunk(filterArray, 4).map(function (_a) {
        var _b = __read(_a, 4), key = _b[0], operator = _b[1], value = _b[2], _c = _b[3], condition = _c === void 0 ? 'AND' : _c;
        return ({
            key: key,
            operator: operator,
            value: value,
            condition: condition,
        });
    });
};
export var toOption = function (value) { return ({ label: value, value: value }); };
export var formatCloudMonitoringError = function (error) {
    var _a;
    var message = (_a = error.statusText) !== null && _a !== void 0 ? _a : '';
    if (error.data && error.data.error) {
        try {
            var res = JSON.parse(error.data.error);
            message += res.error.code + '. ' + res.error.message;
        }
        catch (err) {
            message += error.data.error;
        }
    }
    else if (error.data && error.data.message) {
        try {
            message = JSON.parse(error.data.message).error.message;
        }
        catch (err) {
            error.error = err;
        }
    }
    return message;
};
//# sourceMappingURL=functions.js.map