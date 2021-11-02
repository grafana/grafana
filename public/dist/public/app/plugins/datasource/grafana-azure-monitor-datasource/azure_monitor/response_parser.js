import { __read, __spreadArray } from "tslib";
import { find, get } from 'lodash';
import TimeGrainConverter from '../time_grain_converter';
var ResponseParser = /** @class */ (function () {
    function ResponseParser() {
    }
    ResponseParser.parseResponseValues = function (result, textFieldName, valueFieldName) {
        var list = [];
        if (!result) {
            return list;
        }
        for (var i = 0; i < result.value.length; i++) {
            if (!find(list, ['value', get(result.value[i], valueFieldName)])) {
                var value = get(result.value[i], valueFieldName);
                var text = get(result.value[i], textFieldName, value);
                list.push({
                    text: text,
                    value: value,
                });
            }
        }
        return list;
    };
    ResponseParser.parseResourceNames = function (result, metricDefinition) {
        var list = [];
        if (!result) {
            return list;
        }
        for (var i = 0; i < result.value.length; i++) {
            if (typeof result.value[i].type === 'string' &&
                result.value[i].type.toLocaleLowerCase() === metricDefinition.toLocaleLowerCase()) {
                list.push({
                    text: result.value[i].name,
                    value: result.value[i].name,
                });
            }
        }
        return list;
    };
    ResponseParser.parseMetadata = function (result, metricName) {
        var _a, _b;
        var defaultAggTypes = ['None', 'Average', 'Minimum', 'Maximum', 'Total', 'Count'];
        var metricData = result === null || result === void 0 ? void 0 : result.value.find(function (v) { return v.name.value === metricName; });
        if (!metricData) {
            return {
                primaryAggType: '',
                supportedAggTypes: defaultAggTypes,
                supportedTimeGrains: [],
                dimensions: [],
            };
        }
        return {
            primaryAggType: metricData.primaryAggregationType,
            supportedAggTypes: metricData.supportedAggregationTypes || defaultAggTypes,
            supportedTimeGrains: __spreadArray([
                { label: 'Auto', value: 'auto' }
            ], __read(ResponseParser.parseTimeGrains((_a = metricData.metricAvailabilities) !== null && _a !== void 0 ? _a : [])), false),
            dimensions: ResponseParser.parseDimensions((_b = metricData.dimensions) !== null && _b !== void 0 ? _b : []),
        };
    };
    ResponseParser.parseTimeGrains = function (metricAvailabilities) {
        var timeGrains = [];
        if (!metricAvailabilities) {
            return timeGrains;
        }
        metricAvailabilities.forEach(function (avail) {
            if (avail.timeGrain) {
                timeGrains.push({
                    label: TimeGrainConverter.createTimeGrainFromISO8601Duration(avail.timeGrain),
                    value: avail.timeGrain,
                });
            }
        });
        return timeGrains;
    };
    ResponseParser.parseDimensions = function (metadataDimensions) {
        return metadataDimensions.map(function (dimension) {
            return {
                label: dimension.localizedValue || dimension.value,
                value: dimension.value,
            };
        });
    };
    ResponseParser.parseSubscriptions = function (result) {
        var list = [];
        if (!result) {
            return list;
        }
        var valueFieldName = 'subscriptionId';
        var textFieldName = 'displayName';
        for (var i = 0; i < result.value.length; i++) {
            if (!find(list, ['value', get(result.value[i], valueFieldName)])) {
                list.push({
                    text: "" + get(result.value[i], textFieldName),
                    value: get(result.value[i], valueFieldName),
                });
            }
        }
        return list;
    };
    ResponseParser.parseSubscriptionsForSelect = function (result) {
        var list = [];
        if (!result) {
            return list;
        }
        var valueFieldName = 'subscriptionId';
        var textFieldName = 'displayName';
        for (var i = 0; i < result.data.value.length; i++) {
            if (!find(list, ['value', get(result.data.value[i], valueFieldName)])) {
                list.push({
                    label: get(result.data.value[i], textFieldName) + " - " + get(result.data.value[i], valueFieldName),
                    value: get(result.data.value[i], valueFieldName),
                });
            }
        }
        return list;
    };
    ResponseParser.parseWorkspacesForSelect = function (result) {
        var list = [];
        if (!result) {
            return list;
        }
        var valueFieldName = 'customerId';
        var textFieldName = 'name';
        for (var i = 0; i < result.data.value.length; i++) {
            if (!find(list, ['value', get(result.data.value[i].properties, valueFieldName)])) {
                list.push({
                    label: get(result.data.value[i], textFieldName),
                    value: get(result.data.value[i].properties, valueFieldName),
                });
            }
        }
        return list;
    };
    return ResponseParser;
}());
export default ResponseParser;
//# sourceMappingURL=response_parser.js.map