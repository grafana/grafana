import { __rest } from "tslib";
// Libraries
import { css, cx } from '@emotion/css';
import { map } from 'lodash';
import React, { memo } from 'react';
import { config } from '@grafana/runtime';
import { InlineFormLabel, RadioButtonGroup, InlineField, Input, Select } from '@grafana/ui';
import { getLokiQueryType } from '../queryUtils';
import { LokiQueryType } from '../types';
export const queryTypeOptions = [
    { value: LokiQueryType.Range, label: 'Range', description: 'Run query over a range of time.' },
    {
        value: LokiQueryType.Instant,
        label: 'Instant',
        description: 'Run query against a single point in time. For this query, the "To" time is used.',
    },
];
if (config.featureToggles.lokiExperimentalStreaming) {
    queryTypeOptions.push({
        value: LokiQueryType.Stream,
        label: 'Stream',
        description: 'Run a query and keep sending results on an interval',
    });
}
export const DEFAULT_RESOLUTION = {
    value: 1,
    label: '1/1',
};
export const RESOLUTION_OPTIONS = [DEFAULT_RESOLUTION].concat(map([2, 3, 4, 5, 10], (value) => ({
    value,
    label: '1/' + value,
})));
export function LokiOptionFields(props) {
    var _a;
    const { lineLimitValue, resolution, onRunQuery, runOnBlur, onChange } = props;
    const query = (_a = props.query) !== null && _a !== void 0 ? _a : {};
    const queryType = getLokiQueryType(query);
    function onChangeQueryLimit(value) {
        const nextQuery = Object.assign(Object.assign({}, query), { maxLines: preprocessMaxLines(value) });
        onChange(nextQuery);
    }
    function onQueryTypeChange(queryType) {
        const { instant, range } = query, rest = __rest(query, ["instant", "range"]);
        onChange(Object.assign(Object.assign({}, rest), { queryType }));
    }
    function onMaxLinesChange(e) {
        if (query.maxLines !== preprocessMaxLines(e.currentTarget.value)) {
            onChangeQueryLimit(e.currentTarget.value);
        }
    }
    function onReturnKeyDown(e) {
        if (e.key === 'Enter') {
            onRunQuery();
        }
    }
    function onResolutionChange(option) {
        const nextQuery = Object.assign(Object.assign({}, query), { resolution: option.value });
        onChange(nextQuery);
    }
    return (React.createElement("div", { "aria-label": "Loki extra field", className: "gf-form-inline" },
        React.createElement("div", { "data-testid": "queryTypeField", className: cx('gf-form explore-input-margin', css `
            flex-wrap: nowrap;
          `), "aria-label": "Query type field" },
            React.createElement(InlineFormLabel, { width: "auto" }, "Query type"),
            React.createElement(RadioButtonGroup, { options: queryTypeOptions, value: queryType, onChange: (type) => {
                    onQueryTypeChange(type);
                    if (runOnBlur) {
                        onRunQuery();
                    }
                } })),
        React.createElement("div", { "data-testid": "lineLimitField", className: cx('gf-form', css `
            flex-wrap: nowrap;
          `), "aria-label": "Line limit field" },
            React.createElement(InlineField, { label: "Line limit", tooltip: 'Upper limit for number of log lines returned by query.' },
                React.createElement(Input, { className: "width-4", placeholder: "auto", type: "number", min: 0, onChange: onMaxLinesChange, onKeyDown: onReturnKeyDown, value: lineLimitValue, onBlur: () => {
                        if (runOnBlur) {
                            onRunQuery();
                        }
                    } })),
            React.createElement(InlineField, { label: "Resolution", tooltip: 'Resolution 1/1 sets step parameter of Loki metrics range queries such that each pixel corresponds to one data point. For better performance, lower resolutions can be picked. 1/2 only retrieves a data point for every other pixel, and 1/10 retrieves one data point per 10 pixels.' },
                React.createElement(Select, { isSearchable: false, onChange: onResolutionChange, options: RESOLUTION_OPTIONS, value: resolution, "aria-label": "Select resolution" })))));
}
export default memo(LokiOptionFields);
export function preprocessMaxLines(value) {
    const maxLines = parseInt(value, 10);
    if (isNaN(maxLines) || maxLines < 0) {
        return undefined;
    }
    return maxLines;
}
//# sourceMappingURL=LokiOptionFields.js.map