import React from 'react';
import { ConfigSubSection } from '@grafana/experimental';
import { InlineField, Input, Select, InlineSwitch } from '@grafana/ui';
import { ConfigDescriptionLink } from 'app/core/components/ConfigDescriptionLink';
const indexPatternTypes = [
    { label: 'No pattern', value: 'none' },
    { label: 'Hourly', value: 'Hourly', example: '[logstash-]YYYY.MM.DD.HH' },
    { label: 'Daily', value: 'Daily', example: '[logstash-]YYYY.MM.DD' },
    { label: 'Weekly', value: 'Weekly', example: '[logstash-]GGGG.WW' },
    { label: 'Monthly', value: 'Monthly', example: '[logstash-]YYYY.MM' },
    { label: 'Yearly', value: 'Yearly', example: '[logstash-]YYYY' },
];
export const ElasticDetails = ({ value, onChange }) => {
    var _a, _b;
    return (React.createElement(ConfigSubSection, { title: "Elasticsearch details", description: React.createElement(ConfigDescriptionLink, { description: "Specific settings for the Elasticsearch data source.", suffix: "elasticsearch/#index-settings", feature: "Elasticsearch details" }) },
        React.createElement(InlineField, { label: "Index name", htmlFor: "es_config_indexName", labelWidth: 29, tooltip: "Name of your Elasticsearch index. You can use a time pattern, such as YYYY.MM.DD, or a wildcard for the index name." },
            React.createElement(Input, { id: "es_config_indexName", value: (_a = value.jsonData.index) !== null && _a !== void 0 ? _a : (value.database || ''), onChange: indexChangeHandler(value, onChange), width: 24, placeholder: "es-index-name", required: true })),
        React.createElement(InlineField, { label: "Pattern", htmlFor: "es_config_indexPattern", labelWidth: 29, tooltip: "If you're using a pattern for your index, select the type, or no pattern." },
            React.createElement(Select, { inputId: "es_config_indexPattern", value: indexPatternTypes.find((pattern) => pattern.value === (value.jsonData.interval === undefined ? 'none' : value.jsonData.interval)), options: indexPatternTypes, onChange: intervalHandler(value, onChange), width: 24 })),
        React.createElement(InlineField, { label: "Time field name", htmlFor: "es_config_timeField", labelWidth: 29, tooltip: "Name of your time field. Defaults to @timestamp." },
            React.createElement(Input, { id: "es_config_timeField", value: value.jsonData.timeField || '', onChange: jsonDataChangeHandler('timeField', value, onChange), width: 24, placeholder: "@timestamp", required: true })),
        React.createElement(InlineField, { label: "Max concurrent Shard Requests", htmlFor: "es_config_shardRequests", labelWidth: 29, tooltip: "Maximum number of concurrent shards a search request can hit per node. Defaults to 5." },
            React.createElement(Input, { id: "es_config_shardRequests", value: value.jsonData.maxConcurrentShardRequests || '', onChange: jsonDataChangeHandler('maxConcurrentShardRequests', value, onChange), width: 24 })),
        React.createElement(InlineField, { label: "Min time interval", htmlFor: "es_config_minTimeInterval", labelWidth: 29, tooltip: React.createElement(React.Fragment, null,
                "A lower limit for the auto group by time interval. Recommended to be set to write frequency, for example",
                ' ',
                React.createElement("code", null, "1m"),
                " if your data is written every minute."), error: "Value is not valid, you can use number with time unit specifier: y, M, w, d, h, m, s", invalid: !!value.jsonData.timeInterval && !/^\d+(ms|[Mwdhmsy])$/.test(value.jsonData.timeInterval) },
            React.createElement(Input, { id: "es_config_minTimeInterval", value: value.jsonData.timeInterval || '', onChange: jsonDataChangeHandler('timeInterval', value, onChange), width: 24, placeholder: "10s" })),
        React.createElement(InlineField, { label: "X-Pack enabled", labelWidth: 29, tooltip: "Enable or disable X-Pack specific features" },
            React.createElement(InlineSwitch, { id: "es_config_xpackEnabled", value: value.jsonData.xpack || false, onChange: jsonDataSwitchChangeHandler('xpack', value, onChange) })),
        value.jsonData.xpack && (React.createElement(InlineField, { label: "Include Frozen Indices", htmlFor: "es_config_frozenIndices", labelWidth: 29, tooltip: "Include frozen indices in searches." },
            React.createElement(InlineSwitch, { id: "es_config_frozenIndices", value: (_b = value.jsonData.includeFrozen) !== null && _b !== void 0 ? _b : false, onChange: jsonDataSwitchChangeHandler('includeFrozen', value, onChange) })))));
};
const indexChangeHandler = (value, onChange) => (event) => {
    onChange(Object.assign(Object.assign({}, value), { database: '', jsonData: Object.assign(Object.assign({}, value.jsonData), { index: event.currentTarget.value }) }));
};
// TODO: Use change handlers from @grafana/data
const jsonDataChangeHandler = (key, value, onChange) => (event) => {
    onChange(Object.assign(Object.assign({}, value), { jsonData: Object.assign(Object.assign({}, value.jsonData), { [key]: event.currentTarget.value }) }));
};
const jsonDataSwitchChangeHandler = (key, value, onChange) => (event) => {
    onChange(Object.assign(Object.assign({}, value), { jsonData: Object.assign(Object.assign({}, value.jsonData), { [key]: event.currentTarget.checked }) }));
};
const intervalHandler = (value, onChange) => (option) => {
    var _a, _b;
    // If option value is undefined it will send its label instead so we have to convert made up value to undefined here.
    const newInterval = option.value === 'none' ? undefined : option.value;
    const currentIndex = (_a = value.jsonData.index) !== null && _a !== void 0 ? _a : value.database;
    if (!currentIndex || currentIndex.length === 0 || currentIndex.startsWith('[logstash-]')) {
        let newDatabase = '';
        if (newInterval !== undefined) {
            const pattern = indexPatternTypes.find((pattern) => pattern.value === newInterval);
            if (pattern) {
                newDatabase = (_b = pattern.example) !== null && _b !== void 0 ? _b : '';
            }
        }
        onChange(Object.assign(Object.assign({}, value), { database: '', jsonData: Object.assign(Object.assign({}, value.jsonData), { index: newDatabase, interval: newInterval }) }));
    }
    else {
        onChange(Object.assign(Object.assign({}, value), { jsonData: Object.assign(Object.assign({}, value.jsonData), { interval: newInterval }) }));
    }
};
export function defaultMaxConcurrentShardRequests() {
    return 5;
}
//# sourceMappingURL=ElasticDetails.js.map