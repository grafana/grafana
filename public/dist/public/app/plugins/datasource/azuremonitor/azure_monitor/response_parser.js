import { find, get } from 'lodash';
import TimeGrainConverter from '../time_grain_converter';
export default class ResponseParser {
    static parseResponseValues(result, textFieldName, valueFieldName) {
        const list = [];
        if (!result) {
            return list;
        }
        for (let i = 0; i < result.value.length; i++) {
            if (!find(list, ['value', get(result.value[i], valueFieldName)])) {
                const value = get(result.value[i], valueFieldName);
                const text = get(result.value[i], textFieldName, value);
                list.push({
                    text: text,
                    value: value,
                });
            }
        }
        return list;
    }
    static parseResourceNames(result, metricNamespace) {
        const list = [];
        if (!result) {
            return list;
        }
        for (let i = 0; i < result.value.length; i++) {
            if (typeof result.value[i].type === 'string' &&
                (!metricNamespace || result.value[i].type.toLocaleLowerCase() === metricNamespace.toLocaleLowerCase())) {
                list.push({
                    text: result.value[i].name,
                    value: result.value[i].name,
                });
            }
        }
        return list;
    }
    static parseMetadata(result, metricName) {
        var _a, _b;
        const defaultAggTypes = ['None', 'Average', 'Minimum', 'Maximum', 'Total', 'Count'];
        const metricData = result === null || result === void 0 ? void 0 : result.value.find((v) => v.name.value === metricName);
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
            supportedTimeGrains: [
                { label: 'Auto', value: 'auto' },
                ...ResponseParser.parseTimeGrains((_a = metricData.metricAvailabilities) !== null && _a !== void 0 ? _a : []),
            ],
            dimensions: ResponseParser.parseDimensions((_b = metricData.dimensions) !== null && _b !== void 0 ? _b : []),
        };
    }
    static parseTimeGrains(metricAvailabilities) {
        const timeGrains = [];
        if (!metricAvailabilities) {
            return timeGrains;
        }
        metricAvailabilities.forEach((avail) => {
            if (avail.timeGrain) {
                timeGrains.push({
                    label: TimeGrainConverter.createTimeGrainFromISO8601Duration(avail.timeGrain),
                    value: avail.timeGrain,
                });
            }
        });
        return timeGrains;
    }
    static parseDimensions(metadataDimensions) {
        return metadataDimensions.map((dimension) => {
            return {
                label: dimension.localizedValue || dimension.value,
                value: dimension.value,
            };
        });
    }
    static parseSubscriptions(result) {
        const list = [];
        if (!result) {
            return list;
        }
        const valueFieldName = 'subscriptionId';
        const textFieldName = 'displayName';
        for (let i = 0; i < result.value.length; i++) {
            if (!find(list, ['value', get(result.value[i], valueFieldName)])) {
                list.push({
                    text: `${get(result.value[i], textFieldName)}`,
                    value: get(result.value[i], valueFieldName),
                });
            }
        }
        return list;
    }
    static parseSubscriptionsForSelect(result) {
        const list = [];
        if (!result) {
            return list;
        }
        const valueFieldName = 'subscriptionId';
        const textFieldName = 'displayName';
        for (let i = 0; i < result.data.value.length; i++) {
            if (!find(list, ['value', get(result.data.value[i], valueFieldName)])) {
                list.push({
                    label: `${get(result.data.value[i], textFieldName)} - ${get(result.data.value[i], valueFieldName)}`,
                    value: get(result.data.value[i], valueFieldName),
                });
            }
        }
        return list;
    }
    static parseLocations(result) {
        const locations = [];
        if (!result) {
            return locations;
        }
        for (const location of result.value) {
            locations.push({ name: location.name, displayName: location.displayName, supportsLogs: undefined });
        }
        return locations;
    }
}
//# sourceMappingURL=response_parser.js.map