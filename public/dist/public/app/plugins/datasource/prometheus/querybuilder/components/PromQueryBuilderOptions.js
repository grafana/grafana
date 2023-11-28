import React from 'react';
import { CoreApp } from '@grafana/data';
import { EditorField, EditorRow, EditorSwitch } from '@grafana/experimental';
import { AutoSizeInput, RadioButtonGroup, Select } from '@grafana/ui';
import { getQueryTypeChangeHandler, getQueryTypeOptions } from '../../components/PromExploreExtraField';
import { QueryOptionGroup } from '../shared/QueryOptionGroup';
import { FORMAT_OPTIONS, INTERVAL_FACTOR_OPTIONS } from './PromQueryEditorSelector';
import { getLegendModeLabel, PromQueryLegendEditor } from './PromQueryLegendEditor';
export const PromQueryBuilderOptions = React.memo(({ query, app, onChange, onRunQuery }) => {
    const onChangeFormat = (value) => {
        onChange(Object.assign(Object.assign({}, query), { format: value.value }));
        onRunQuery();
    };
    const onChangeStep = (evt) => {
        onChange(Object.assign(Object.assign({}, query), { interval: evt.currentTarget.value }));
        onRunQuery();
    };
    const queryTypeOptions = getQueryTypeOptions(app === CoreApp.Explore || app === CoreApp.Correlations || app === CoreApp.PanelEditor);
    const onQueryTypeChange = getQueryTypeChangeHandler(query, onChange);
    const onExemplarChange = (event) => {
        const isEnabled = event.currentTarget.checked;
        onChange(Object.assign(Object.assign({}, query), { exemplar: isEnabled }));
        onRunQuery();
    };
    const onIntervalFactorChange = (value) => {
        onChange(Object.assign(Object.assign({}, query), { intervalFactor: value.value }));
        onRunQuery();
    };
    const formatOption = FORMAT_OPTIONS.find((option) => option.value === query.format) || FORMAT_OPTIONS[0];
    const queryTypeValue = getQueryTypeValue(query);
    const queryTypeLabel = queryTypeOptions.find((x) => x.value === queryTypeValue).label;
    return (React.createElement(EditorRow, null,
        React.createElement(QueryOptionGroup, { title: "Options", collapsedInfo: getCollapsedInfo(query, formatOption.label, queryTypeLabel, app) },
            React.createElement(PromQueryLegendEditor, { legendFormat: query.legendFormat, onChange: (legendFormat) => onChange(Object.assign(Object.assign({}, query), { legendFormat })), onRunQuery: onRunQuery }),
            React.createElement(EditorField, { label: "Min step", tooltip: React.createElement(React.Fragment, null,
                    "An additional lower limit for the step parameter of the Prometheus query and for the",
                    ' ',
                    React.createElement("code", null, "$__interval"),
                    " and ",
                    React.createElement("code", null, "$__rate_interval"),
                    " variables.") },
                React.createElement(AutoSizeInput, { type: "text", "aria-label": "Set lower limit for the step parameter", placeholder: 'auto', minWidth: 10, onCommitChange: onChangeStep, defaultValue: query.interval })),
            React.createElement(EditorField, { label: "Format" },
                React.createElement(Select, { value: formatOption, allowCustomValue: true, onChange: onChangeFormat, options: FORMAT_OPTIONS })),
            React.createElement(EditorField, { label: "Type" },
                React.createElement(RadioButtonGroup, { options: queryTypeOptions, value: queryTypeValue, onChange: onQueryTypeChange })),
            shouldShowExemplarSwitch(query, app) && (React.createElement(EditorField, { label: "Exemplars" },
                React.createElement(EditorSwitch, { value: query.exemplar || false, onChange: onExemplarChange }))),
            query.intervalFactor && query.intervalFactor > 1 && (React.createElement(EditorField, { label: "Resolution" },
                React.createElement(Select, { "aria-label": "Select resolution", isSearchable: false, options: INTERVAL_FACTOR_OPTIONS, onChange: onIntervalFactorChange, value: INTERVAL_FACTOR_OPTIONS.find((option) => option.value === query.intervalFactor) }))))));
});
function shouldShowExemplarSwitch(query, app) {
    if (app === CoreApp.UnifiedAlerting || !query.range) {
        return false;
    }
    return true;
}
function getQueryTypeValue(query) {
    return query.range && query.instant ? 'both' : query.instant ? 'instant' : 'range';
}
function getCollapsedInfo(query, formatOption, queryType, app) {
    var _a;
    const items = [];
    items.push(`Legend: ${getLegendModeLabel(query.legendFormat)}`);
    items.push(`Format: ${formatOption}`);
    items.push(`Step: ${(_a = query.interval) !== null && _a !== void 0 ? _a : 'auto'}`);
    items.push(`Type: ${queryType}`);
    if (shouldShowExemplarSwitch(query, app)) {
        if (query.exemplar) {
            items.push(`Exemplars: true`);
        }
        else {
            items.push(`Exemplars: false`);
        }
    }
    return items;
}
PromQueryBuilderOptions.displayName = 'PromQueryBuilderOptions';
//# sourceMappingURL=PromQueryBuilderOptions.js.map