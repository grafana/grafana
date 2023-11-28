import { css, cx } from '@emotion/css';
import { isEqual } from 'lodash';
import React, { memo, useCallback } from 'react';
import { usePrevious } from 'react-use';
import { InlineFormLabel, RadioButtonGroup } from '@grafana/ui';
import { PromExemplarField } from './PromExemplarField';
export const PromExploreExtraField = memo(({ query, datasource, onChange, onRunQuery }) => {
    var _a;
    const rangeOptions = getQueryTypeOptions(true);
    const prevQuery = usePrevious(query);
    const onExemplarChange = useCallback((exemplar) => {
        if (!isEqual(query, prevQuery) || exemplar !== query.exemplar) {
            onChange(Object.assign(Object.assign({}, query), { exemplar }));
        }
    }, [prevQuery, query, onChange]);
    function onChangeQueryStep(interval) {
        onChange(Object.assign(Object.assign({}, query), { interval }));
    }
    function onStepChange(e) {
        if (e.currentTarget.value !== query.interval) {
            onChangeQueryStep(e.currentTarget.value);
        }
    }
    function onReturnKeyDown(e) {
        if (e.key === 'Enter' && e.shiftKey) {
            onRunQuery();
        }
    }
    const onQueryTypeChange = getQueryTypeChangeHandler(query, onChange);
    return (React.createElement("div", { "aria-label": "Prometheus extra field", className: "gf-form-inline", "data-testid": testIds.extraFieldEditor },
        React.createElement("div", { "data-testid": testIds.queryTypeField, className: cx('gf-form explore-input-margin', css `
            flex-wrap: nowrap;
          `), "aria-label": "Query type field" },
            React.createElement(InlineFormLabel, { width: "auto" }, "Query type"),
            React.createElement(RadioButtonGroup, { options: rangeOptions, value: query.range && query.instant ? 'both' : query.instant ? 'instant' : 'range', onChange: onQueryTypeChange })),
        React.createElement("div", { "data-testid": testIds.stepField, className: cx('gf-form', css `
            flex-wrap: nowrap;
          `), "aria-label": "Step field" },
            React.createElement(InlineFormLabel, { width: 6, tooltip: 'Time units and built-in variables can be used here, for example: $__interval, $__rate_interval, 5s, 1m, 3h, 1d, 1y (Default if no unit is specified: s)' }, "Min step"),
            React.createElement("input", { type: 'text', className: "gf-form-input width-4", placeholder: 'auto', onChange: onStepChange, onKeyDown: onReturnKeyDown, value: (_a = query.interval) !== null && _a !== void 0 ? _a : '' })),
        React.createElement(PromExemplarField, { onChange: onExemplarChange, datasource: datasource, query: query })));
});
PromExploreExtraField.displayName = 'PromExploreExtraField';
export function getQueryTypeOptions(includeBoth) {
    const rangeOptions = [
        { value: 'range', label: 'Range', description: 'Run query over a range of time' },
        {
            value: 'instant',
            label: 'Instant',
            description: 'Run query against a single point in time. For this query, the "To" time is used',
        },
    ];
    if (includeBoth) {
        rangeOptions.push({ value: 'both', label: 'Both', description: 'Run an Instant query and a Range query' });
    }
    return rangeOptions;
}
export function getQueryTypeChangeHandler(query, onChange) {
    return (queryType) => {
        if (queryType === 'instant') {
            onChange(Object.assign(Object.assign({}, query), { instant: true, range: false, exemplar: false }));
        }
        else if (queryType === 'range') {
            onChange(Object.assign(Object.assign({}, query), { instant: false, range: true }));
        }
        else {
            onChange(Object.assign(Object.assign({}, query), { instant: true, range: true }));
        }
    };
}
export const testIds = {
    extraFieldEditor: 'prom-editor-extra-field',
    stepField: 'prom-editor-extra-field-step',
    queryTypeField: 'prom-editor-extra-field-query-type',
};
//# sourceMappingURL=PromExploreExtraField.js.map