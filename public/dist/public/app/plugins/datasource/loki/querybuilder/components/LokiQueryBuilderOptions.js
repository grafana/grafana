import { trim } from 'lodash';
import React, { useMemo, useState } from 'react';
import { isValidDuration, isValidGrafanaDuration } from '@grafana/data';
import { EditorField, EditorRow } from '@grafana/experimental';
import { config, reportInteraction } from '@grafana/runtime';
import { Alert, AutoSizeInput, RadioButtonGroup, Select } from '@grafana/ui';
import { QueryOptionGroup } from 'app/plugins/datasource/prometheus/querybuilder/shared/QueryOptionGroup';
import { preprocessMaxLines, queryTypeOptions, RESOLUTION_OPTIONS } from '../../components/LokiOptionFields';
import { getLokiQueryType, isLogsQuery } from '../../queryUtils';
export const LokiQueryBuilderOptions = React.memo(({ app, query, onChange, onRunQuery, maxLines, queryStats }) => {
    var _a, _b, _c, _d;
    const [splitDurationValid, setSplitDurationValid] = useState(true);
    const onQueryTypeChange = (value) => {
        onChange(Object.assign(Object.assign({}, query), { queryType: value }));
        onRunQuery();
    };
    const onResolutionChange = (option) => {
        reportInteraction('grafana_loki_resolution_clicked', {
            app,
            resolution: option.value,
        });
        onChange(Object.assign(Object.assign({}, query), { resolution: option.value }));
        onRunQuery();
    };
    const onChunkRangeChange = (evt) => {
        const value = evt.currentTarget.value;
        if (!isValidDuration(value)) {
            setSplitDurationValid(false);
            return;
        }
        setSplitDurationValid(true);
        onChange(Object.assign(Object.assign({}, query), { splitDuration: value }));
        onRunQuery();
    };
    const onLegendFormatChanged = (evt) => {
        onChange(Object.assign(Object.assign({}, query), { legendFormat: evt.currentTarget.value }));
        onRunQuery();
    };
    function onMaxLinesChange(e) {
        const newMaxLines = preprocessMaxLines(e.currentTarget.value);
        if (query.maxLines !== newMaxLines) {
            onChange(Object.assign(Object.assign({}, query), { maxLines: newMaxLines }));
            onRunQuery();
        }
    }
    function onStepChange(e) {
        onChange(Object.assign(Object.assign({}, query), { step: trim(e.currentTarget.value) }));
        onRunQuery();
    }
    const queryType = getLokiQueryType(query);
    const isLogQuery = isLogsQuery(query.expr);
    const isValidStep = useMemo(() => {
        if (!query.step || isValidGrafanaDuration(query.step) || !isNaN(Number(query.step))) {
            return true;
        }
        return false;
    }, [query.step]);
    return (React.createElement(EditorRow, null,
        React.createElement(QueryOptionGroup, { title: "Options", collapsedInfo: getCollapsedInfo(query, queryType, maxLines, isLogQuery, isValidStep), queryStats: queryStats },
            React.createElement(EditorField, { label: "Legend", tooltip: "Series name override or template. Ex. {{hostname}} will be replaced with label value for hostname." },
                React.createElement(AutoSizeInput, { placeholder: "{{label}}", type: "string", minWidth: 14, defaultValue: query.legendFormat, onCommitChange: onLegendFormatChanged })),
            React.createElement(EditorField, { label: "Type" },
                React.createElement(RadioButtonGroup, { options: queryTypeOptions, value: queryType, onChange: onQueryTypeChange })),
            isLogQuery && (React.createElement(EditorField, { label: "Line limit", tooltip: "Upper limit for number of log lines returned by query." },
                React.createElement(AutoSizeInput, { className: "width-4", placeholder: maxLines.toString(), type: "number", min: 0, defaultValue: (_b = (_a = query.maxLines) === null || _a === void 0 ? void 0 : _a.toString()) !== null && _b !== void 0 ? _b : '', onCommitChange: onMaxLinesChange }))),
            !isLogQuery && (React.createElement(React.Fragment, null,
                React.createElement(EditorField, { label: "Step", tooltip: "Use the step parameter when making metric queries to Loki. If not filled, Grafana's calculated interval will be used. Example valid values: 1s, 5m, 10h, 1d.", invalid: !isValidStep, error: 'Invalid step. Example valid values: 1s, 5m, 10h, 1d.' },
                    React.createElement(AutoSizeInput, { className: "width-6", placeholder: 'auto', type: "string", defaultValue: (_c = query.step) !== null && _c !== void 0 ? _c : '', onCommitChange: onStepChange })),
                query.resolution !== undefined && query.resolution > 1 && (React.createElement(React.Fragment, null,
                    React.createElement(EditorField, { label: "Resolution", tooltip: "Changes the step parameter of Loki metrics range queries. With a resolution of 1/1, each pixel corresponds to one data point. 1/10 retrieves one data point per 10 pixels. Lower resolutions perform better." },
                        React.createElement(Select, { isSearchable: false, onChange: onResolutionChange, options: RESOLUTION_OPTIONS, value: query.resolution || 1, "aria-label": "Select resolution" })),
                    React.createElement(Alert, { severity: "warning", title: "The 'Resolution' is deprecated. Use 'Step' editor instead to change step parameter." }))))),
            config.featureToggles.lokiQuerySplittingConfig && config.featureToggles.lokiQuerySplitting && (React.createElement(EditorField, { label: "Split Duration", tooltip: "Defines the duration of a single query when query splitting is enabled." },
                React.createElement(AutoSizeInput, { minWidth: 14, type: "string", min: 0, defaultValue: (_d = query.splitDuration) !== null && _d !== void 0 ? _d : '1d', onCommitChange: onChunkRangeChange, invalid: !splitDurationValid }))))));
});
function getCollapsedInfo(query, queryType, maxLines, isLogQuery, isValidStep) {
    var _a;
    const queryTypeLabel = queryTypeOptions.find((x) => x.value === queryType);
    const resolutionLabel = RESOLUTION_OPTIONS.find((x) => { var _a; return x.value === ((_a = query.resolution) !== null && _a !== void 0 ? _a : 1); });
    const items = [];
    if (query.legendFormat) {
        items.push(`Legend: ${query.legendFormat}`);
    }
    items.push(`Type: ${queryTypeLabel === null || queryTypeLabel === void 0 ? void 0 : queryTypeLabel.label}`);
    if (isLogQuery) {
        items.push(`Line limit: ${(_a = query.maxLines) !== null && _a !== void 0 ? _a : maxLines}`);
    }
    if (!isLogQuery) {
        if (query.step) {
            items.push(`Step: ${isValidStep ? query.step : 'Invalid value'}`);
        }
        if (query.resolution) {
            items.push(`Resolution: ${resolutionLabel === null || resolutionLabel === void 0 ? void 0 : resolutionLabel.label}`);
        }
    }
    return items;
}
LokiQueryBuilderOptions.displayName = 'LokiQueryBuilderOptions';
//# sourceMappingURL=LokiQueryBuilderOptions.js.map