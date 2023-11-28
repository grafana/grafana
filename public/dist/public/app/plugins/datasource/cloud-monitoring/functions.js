import { __awaiter } from "tslib";
import { chunk, initial, startCase, uniqBy } from 'lodash';
import { rangeUtil } from '@grafana/data';
import { getTemplateSrv } from '@grafana/runtime';
import { AGGREGATIONS, ALIGNMENTS, SYSTEM_LABELS } from './constants';
import { AlignmentTypes, PreprocessorType, MetricKind, ValueTypes } from './types/query';
export const extractServicesFromMetricDescriptors = (metricDescriptors) => uniqBy(metricDescriptors, 'service');
export const getMetricTypesByService = (metricDescriptors, service) => metricDescriptors.filter((m) => m.service === service);
export const getMetricTypes = (metricDescriptors, metricType, interpolatedMetricType, selectedService) => {
    const metricTypes = getMetricTypesByService(metricDescriptors, selectedService).map((m) => ({
        value: m.type,
        name: m.displayName,
    }));
    const metricTypeExistInArray = metricTypes.some((m) => m.value === interpolatedMetricType);
    const metricTypeByService = metricTypes.length ? metricTypes[0].value : '';
    const selectedMetricType = metricTypeExistInArray ? metricType : metricTypeByService;
    return {
        metricTypes,
        selectedMetricType,
    };
};
export const getAlignmentOptionsByMetric = (metricValueType, metricKind, preprocessor) => {
    if (preprocessor && preprocessor === PreprocessorType.Rate) {
        metricKind = MetricKind.GAUGE;
    }
    return !metricValueType
        ? []
        : ALIGNMENTS.filter((i) => {
            return (i.valueTypes.indexOf(metricValueType) !== -1 &&
                i.metricKinds.indexOf(metricKind) !== -1);
        });
};
export const getAggregationOptionsByMetric = (valueType, metricKind) => {
    return !metricKind
        ? []
        : AGGREGATIONS.filter((i) => {
            return i.valueTypes.indexOf(valueType) !== -1 && i.metricKinds.indexOf(metricKind) !== -1;
        });
};
export const getLabelKeys = (datasource, selectedMetricType, projectName) => __awaiter(void 0, void 0, void 0, function* () {
    const refId = 'handleLabelKeysQuery';
    const labels = yield datasource.getLabels(selectedMetricType, refId, projectName);
    return [...Object.keys(labels), ...SYSTEM_LABELS];
});
export const getAlignmentPickerData = (valueType = ValueTypes.DOUBLE, metricKind = MetricKind.GAUGE, perSeriesAligner = AlignmentTypes.ALIGN_MEAN, preprocessor) => {
    const templateSrv = getTemplateSrv();
    const alignOptions = getAlignmentOptionsByMetric(valueType, metricKind, preprocessor).map((option) => (Object.assign(Object.assign({}, option), { label: option.text })));
    if (!alignOptions.some((o) => o.value === templateSrv.replace(perSeriesAligner))) {
        perSeriesAligner = alignOptions.length > 0 ? alignOptions[0].value : AlignmentTypes.ALIGN_MEAN;
    }
    return { alignOptions, perSeriesAligner };
};
export const labelsToGroupedOptions = (groupBys) => {
    const groups = groupBys.reduce((acc, curr) => {
        const arr = curr.split('.').map(startCase);
        const group = (arr.length === 2 ? arr : initial(arr)).join(' ');
        const option = {
            value: curr,
            label: curr,
        };
        if (acc[group]) {
            acc[group] = [...acc[group], option];
        }
        else {
            acc[group] = [option];
        }
        return acc;
    }, {});
    return Object.entries(groups).map(([label, options]) => ({ label, options, expanded: true }), []);
};
export const stringArrayToFilters = (filterArray) => chunk(filterArray, 4).map(([key, operator, value, condition = 'AND']) => ({
    key,
    operator,
    value,
    condition,
}));
export const alignmentPeriodLabel = (customMetaData, datasource) => {
    var _a;
    const { perSeriesAligner, alignmentPeriod } = customMetaData;
    if (!alignmentPeriod || !perSeriesAligner) {
        return '';
    }
    const alignment = ALIGNMENTS.find((ap) => ap.value === datasource.templateSrv.replace(perSeriesAligner));
    const seconds = parseInt(alignmentPeriod, 10);
    const hms = rangeUtil.secondsToHms(seconds);
    return `${hms} interval (${(_a = alignment === null || alignment === void 0 ? void 0 : alignment.text) !== null && _a !== void 0 ? _a : ''})`;
};
export const getMetricType = (query) => {
    var _a, _b;
    const metricTypeKey = (_a = query === null || query === void 0 ? void 0 : query.filters) === null || _a === void 0 ? void 0 : _a.findIndex((f) => f === 'metric.type');
    // filters are in the format [key, operator, value] so we need to add 2 to get the value
    const metricType = (_b = query === null || query === void 0 ? void 0 : query.filters) === null || _b === void 0 ? void 0 : _b[metricTypeKey + 2];
    return metricType || '';
};
export const setMetricType = (query, metricType) => {
    var _a;
    if (!query.filters) {
        query.filters = ['metric.type', '=', metricType];
        return query;
    }
    const metricTypeKey = (_a = query === null || query === void 0 ? void 0 : query.filters) === null || _a === void 0 ? void 0 : _a.findIndex((f) => f === 'metric.type');
    if (metricTypeKey === -1) {
        query.filters.push('metric.type', '=', metricType);
    }
    else {
        // filters are in the format [key, operator, value] so we need to add 2 to get the value
        query.filters[metricTypeKey + 2] = metricType;
    }
    return query;
};
//# sourceMappingURL=functions.js.map